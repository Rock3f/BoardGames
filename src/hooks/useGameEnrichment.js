import { supabase } from '../lib/supabase'

const WD_API = 'https://www.wikidata.org/w/api.php'
const CF_WORKER = 'https://shy-glitter-7f27.badier-tanguy.workers.dev'

const LANG_NAMES = [
  // Noms anglais
  'English', 'French', 'German', 'Spanish', 'Italian', 'Dutch', 'Portuguese',
  'Russian', 'Japanese', 'Korean', 'Chinese', 'Polish', 'Swedish', 'Norwegian',
  'Danish', 'Finnish', 'Czech', 'Slovak', 'Hungarian', 'Romanian', 'Greek',
  'Turkish', 'Arabic', 'Hebrew', 'Thai', 'Indonesian', 'Ukrainian', 'Bulgarian',
  'Croatian', 'Serbian', 'Catalan',
  // Noms français
  'Français', 'Anglais', 'Allemand', 'Espagnol', 'Italien', 'Néerlandais', 'Portugais',
].join('|')

const EDITION_SUFFIX = `(?:\\s+(?:Edition|Édition|Version|Ed\\.?|Ver\\.?))?`
// Supprime : " French", " French Edition", " - French Edition", " (French)", " (French Edition)"
const LANG_RE = new RegExp(
  `(?:(?:\\s*[-–]\\s*|\\s+)(?:${LANG_NAMES})${EDITION_SUFFIX}|\\s*\\((?:${LANG_NAMES})${EDITION_SUFFIX}\\s*\\))\\s*$`,
  'i'
)

export function cleanTitle(rawTitle) {
  if (!rawTitle) return ''
  let title = rawTitle.split(/\s[-–]\s/)[0].trim()
  title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim()
  title = title.replace(LANG_RE, '').trim()
  return title
}

// ── Philibert scraping (EAN → page produit → données structurées) ────────────

function parsePhilibertHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // JSON-LD Product schema — condition nécessaire pour identifier une page produit.
  // Sans ça, le h1 générique du site ("Le spécialiste du jeu de société") serait pris comme titre.
  let jsonLd = null
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent)
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      const product = candidates.find((d) => d['@type'] === 'Product')
      if (product) { jsonLd = product; break }
    } catch {}
  }

  if (!jsonLd) return null // pas une page produit (page de résultats, accueil, etc.)

  // Applique cleanTitle pour enlever suffixes d'édition/langue du nom produit Philibert
  const name = cleanTitle(jsonLd.name?.trim() ?? '')
  if (!name) return null

  let description = jsonLd?.description ?? ''
  if (!description) {
    description = (
      doc.querySelector('[itemprop="description"], .product-description, .rte, #short_description_content')
        ?.textContent ?? ''
    ).trim()
  }
  // Strip les balises HTML résiduelles, normalise les espaces
  description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)

  // og:image en priorité (toujours la photo de boîte sur une page produit e-commerce)
  let image =
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ??
    (jsonLd?.image ? (Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image) : null) ??
    doc.querySelector('[itemprop="image"]')?.getAttribute('src') ??
    doc.querySelector('.product-cover img, #product-cover img, .js-qv-product-cover')?.getAttribute('src') ??
    null
  if (image && !image.startsWith('http')) image = `https://www.philibertnet.com${image}`

  // Éditeur depuis JSON-LD (brand ou manufacturer)
  let publisher =
    jsonLd.brand?.name?.trim() ??
    jsonLd.manufacturer?.name?.trim() ??
    null

  let minPlayers = null, maxPlayers = null, minPlayTime = null, maxPlayTime = null

  function parseRange(label, value) {
    if (/joueur|player/i.test(label)) {
      const m = value.match(/(\d+)\s*[-àa]\s*(\d+)/) || value.match(/(\d+)/)
      if (m) { minPlayers = +m[1]; maxPlayers = m[2] ? +m[2] : +m[1] }
    }
    if (/dur[ée]|time|minute/i.test(label)) {
      const m = value.match(/(\d+)\s*[-àa]\s*(\d+)/) || value.match(/(\d+)/)
      if (m) { minPlayTime = +m[1]; maxPlayTime = m[2] ? +m[2] : +m[1] }
    }
    if (!publisher && /éditeur|publisher|marque|brand|fabricant/i.test(label)) {
      publisher = value || null
    }
  }

  // 1. additionalProperty dans le JSON-LD (source la plus fiable)
  if (Array.isArray(jsonLd.additionalProperty)) {
    for (const prop of jsonLd.additionalProperty) {
      if (prop['@type'] !== 'PropertyValue') continue
      parseRange((prop.name ?? '').toLowerCase(), String(prop.value ?? '').trim())
    }
  }

  // 2. <dl> PrestaShop standard
  if (minPlayers === null || minPlayTime === null) {
    for (const dt of doc.querySelectorAll('dt')) {
      parseRange(dt.textContent.toLowerCase(), dt.nextElementSibling?.textContent?.trim() ?? '')
    }
  }

  // 3. Lignes de tableau
  if (minPlayers === null || minPlayTime === null) {
    for (const row of doc.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td, th')
      if (cells.length < 2) continue
      parseRange(cells[0].textContent.toLowerCase(), cells[1].textContent.trim())
    }
  }

  // 4. <li> dans les listes de caractéristiques
  if (minPlayers === null || minPlayTime === null) {
    for (const li of doc.querySelectorAll('li')) {
      const text = li.textContent
      parseRange(text.toLowerCase(), text)
    }
  }

  // 5. Regex sur tout le texte visible
  if (minPlayers === null) {
    const bodyText = doc.body?.textContent ?? ''
    const pm = bodyText.match(/(\d+)\s*[-àa]\s*(\d+)\s*joueurs?/i) ||
      bodyText.match(/(\d+)\s+joueurs?/i)
    if (pm) { minPlayers = +pm[1]; maxPlayers = pm[2] ? +pm[2] : +pm[1] }
    const dm = bodyText.match(/(\d+)\s*[-àa]\s*(\d+)\s*min/i) ||
      bodyText.match(/(\d+)\s+min(?:utes?)?(?:\s+environ)?/i)
    if (dm) { minPlayTime = +dm[1]; maxPlayTime = dm[2] ? +dm[2] : +dm[1] }
  }

  return { name, description, image, publisher, minPlayers, maxPlayers, minPlayTime, maxPlayTime }
}

// Récupère le HTML d'une URL Philibert : CF Worker d'abord, puis Edge Function en fallback
async function fetchPhilibertHtml(url) {
  // 1. CF Worker
  try {
    const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) return await res.text()
  } catch {}

  // 2. Supabase Edge Function (Deno Deploy, réseau différent — contourne le blocage CF→CF)
  const { data, error } = await supabase.functions.invoke('bgg-proxy', {
    body: { action: 'proxy', url },
  })
  if (error || !data?.html) throw new Error('Proxy indisponible')
  return data.html
}

export async function lookupPhilibert(query) {
  try {
    const searchUrl = `https://www.philibertnet.com/fr/recherche?q=${encodeURIComponent(query)}`
    const html = await fetchPhilibertHtml(searchUrl)

    // Cas 1 : la recherche redirige directement sur la page produit
    const direct = parsePhilibertHtml(html)
    if (direct) return direct

    // Cas 2 : page de résultats → premier lien produit
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const anchor =
      doc.querySelector('.product-miniature a.product-thumbnail, .product-container a[href$=".html"], article a[href$=".html"]') ||
      doc.querySelector('a[href*="/fr/"][href$=".html"]')
    if (!anchor) return null

    // Thumbnail de la carte produit dans les résultats (photo de boîte)
    const card = anchor.closest('.product-miniature, .product-container, article')
    const thumbEl = card?.querySelector('img[src], img[data-src]')
    let cardImage = thumbEl?.getAttribute('src') || thumbEl?.getAttribute('data-src') || null
    if (cardImage && !cardImage.startsWith('http')) cardImage = `https://www.philibertnet.com${cardImage}`

    let productUrl = anchor.getAttribute('href')
    if (!productUrl || productUrl === '#') return null
    if (!productUrl.startsWith('http')) productUrl = `https://www.philibertnet.com${productUrl}`

    const productHtml = await fetchPhilibertHtml(productUrl)
    const productData = parsePhilibertHtml(productHtml)
    if (productData && !productData.image && cardImage) productData.image = cardImage
    return productData
  } catch {
    return null
  }
}

// ── UPC lookup via edge function ──────────────────────────────────────────────

export async function lookupUpc(ean) {
  const { data, error } = await supabase.functions.invoke('bgg-proxy', {
    body: { action: 'upc', ean },
  })
  if (error) throw new Error(error.message || 'Erreur lors de la recherche UPC.')
  if (data?.error) throw new Error(data.error)
  return data.title
}

// ── Recherche via Wikidata (CORS natif, pas de proxy nécessaire) ──────────────

// Descriptions Wikidata qui indiquent un jeu de société / cartes / plateau
const BOARD_GAME_RE =
  /jeu\s+de\s+(soci[eé]t[eé]|plateau|cartes?|d[eé]s|r[oô]le)|board\s+game|card\s+game|tabletop\s+game/i

export async function searchBgg(query) {
  // On demande 50 résultats pour avoir assez de jeux après filtrage
  const url =
    `${WD_API}?action=wbsearchentities` +
    `&search=${encodeURIComponent(query)}` +
    `&language=fr&format=json&type=item&limit=50&origin=*`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Recherche Wikidata échouée (${res.status})`)
  const json = await res.json()

  const all = (json.search ?? [])
    .map((item) => ({
      id: item.id,
      name: item.label ?? '',
      yearPublished: null,
      description: item.description ?? '',
    }))
    .filter((g) => g.id && g.name)

  // Filtre sur les jeux de société ; si aucun résultat filtré, retourne tout (jeu inconnu de Wikidata)
  const games = all.filter((g) => BOARD_GAME_RE.test(g.description))
  return (games.length > 0 ? games : all).slice(0, 15)
}

// ── Données du jeu via Wikidata entity ───────────────────────────────────────

export async function fetchBggThing(id) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${id}.json`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Entité Wikidata introuvable (${res.status})`)
  const json = await res.json()

  const entity = json.entities?.[id]
  if (!entity) throw new Error('Jeu non trouvé')

  function firstValue(prop) {
    return entity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value ?? null
  }

  // Nom en FR puis EN
  const name =
    entity.labels?.fr?.value ?? entity.labels?.en?.value ?? ''

  // Année de publication (P577 = date de publication, format "+1995-01-01T00:00:00Z")
  const yearRaw = firstValue('P577')
  const yearPublished = yearRaw?.time
    ? parseInt(yearRaw.time.replace(/^\+/, '').slice(0, 4))
    : null

  // Joueurs (P1872 = min, P1873 = max) — valeur quantity : { amount: "+3", unit: "1" }
  function numProp(prop) {
    const v = firstValue(prop)
    if (v == null) return null
    if (typeof v === 'number') return v
    if (v?.amount) return Math.abs(parseInt(v.amount))
    return null
  }

  // Durée (P2047, en minutes) — quantity avec lowerBound/upperBound pour min/max
  function durationProp() {
    const v = entity.claims?.P2047?.[0]?.mainsnak?.datavalue?.value
    if (!v?.amount) return [null, null]
    const amt = Math.abs(parseInt(v.amount))
    const low = v.lowerBound ? Math.abs(parseInt(v.lowerBound)) : amt
    const high = v.upperBound ? Math.abs(parseInt(v.upperBound)) : amt
    return [low, high]
  }
  const [minPlayTime, maxPlayTime] = durationProp()

  // Description : Wikipedia REST (paragraphe complet) > Wikidata (une ligne)
  let description =
    entity.descriptions?.fr?.value ?? entity.descriptions?.en?.value ?? ''
  const wikilinks = entity.sitelinks ?? {}
  const wikiTitle = wikilinks.frwiki?.title ?? wikilinks.enwiki?.title ?? null
  const wikiLang = wikilinks.frwiki ? 'fr' : 'en'
  // Image et description depuis Wikipedia Summary (thumbnail = photo principale de l'article = boîte du jeu)
  let image = null
  if (wikiTitle) {
    try {
      const summaryUrl =
        `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/` +
        encodeURIComponent(wikiTitle.replace(/ /g, '_'))
      const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(5000) })
      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json()
        // Pour les articles de jeux, le 1er paragraphe est historique ("publié par X en 1995..."),
        // le 2e explique le principe du jeu — on préfère le 2e (ou le 1er si c'est le seul).
        if (summaryJson.extract) {
          const paras = summaryJson.extract
            .split(/\n+/)
            .map((p) => p.trim())
            .filter((p) => p.length > 40)
          description = (paras.length > 1 ? paras.slice(1).join(' ') : paras[0] ?? '')
            .slice(0, 600)
        }
        image =
          summaryJson.originalimage?.source ??
          summaryJson.thumbnail?.source ??
          null
      }
    } catch {}
  }

  // Éditeur (P123 = publisher) — stocké comme QID, on résout le label en FR/EN
  let publisher = null
  const publisherQid = firstValue('P123')?.id ?? null
  if (publisherQid) {
    try {
      const pubUrl =
        `${WD_API}?action=wbgetentities&ids=${publisherQid}` +
        `&props=labels&languages=fr%7Cen&format=json&origin=*`
      const pubRes = await fetch(pubUrl, { signal: AbortSignal.timeout(4000) })
      if (pubRes.ok) {
        const pubJson = await pubRes.json()
        const pubEntity = pubJson.entities?.[publisherQid]
        publisher = pubEntity?.labels?.fr?.value ?? pubEntity?.labels?.en?.value ?? null
      }
    } catch {}
  }

  return {
    name,
    yearPublished,
    publisher,
    minPlayers: numProp('P1872'),
    maxPlayers: numProp('P1873'),
    minPlayTime,
    maxPlayTime,
    description,
    image,
  }
}

// ── Téléchargement de la cover ────────────────────────────────────────────────

function blobToFile(blob) {
  const ext = (blob.type.split('/')[1] || 'jpg').replace(/\+.*$/, '')
  return new File([blob], `cover.${ext}`, { type: blob.type || 'image/jpeg' })
}

export async function downloadBggCover(imageUrl) {
  // 1. Fetch direct (fonctionne pour Wikimedia qui expose CORS)
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) })
    if (res.ok) return blobToFile(await res.blob())
  } catch {}

  // 2. CF Worker (pour la plupart des domaines, mais CF→CF peut être bloqué par Philibert)
  try {
    const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(imageUrl)}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) return blobToFile(await res.blob())
  } catch {}

  // 3. Supabase Edge Function (Deno Deploy, réseau différent — contourne le blocage CF→CF Philibert)
  const { data, error } = await supabase.functions.invoke('bgg-proxy', {
    body: { action: 'image', url: imageUrl },
  })
  if (error || !data?.base64) throw new Error('Téléchargement de la couverture échoué')

  const binary = atob(data.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: data.contentType || 'image/jpeg' })
  return blobToFile(blob)
}
