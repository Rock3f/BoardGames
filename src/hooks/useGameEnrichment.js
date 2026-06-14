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

  let image = jsonLd?.image ? (Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image) : null
  if (!image) {
    image = doc.querySelector('[itemprop="image"]')?.getAttribute('src') ||
      doc.querySelector('.product-cover img, #product-cover img')?.getAttribute('src') || null
  }
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

export async function lookupPhilibert(ean) {
  try {
    const searchUrl = `https://www.philibertnet.com/fr/recherche?q=${encodeURIComponent(ean)}`
    const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(searchUrl)}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // Cas 1 : la recherche redirige directement sur la page produit
    const direct = parsePhilibertHtml(html)
    if (direct) return direct

    // Cas 2 : page de résultats → premier lien produit
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const anchor =
      doc.querySelector('.product-miniature a.product-thumbnail, .product-container a[href$=".html"], article a[href$=".html"]') ||
      doc.querySelector('a[href*="/fr/"][href$=".html"]')
    if (!anchor) return null

    let productUrl = anchor.getAttribute('href')
    if (!productUrl || productUrl === '#') return null
    if (!productUrl.startsWith('http')) productUrl = `https://www.philibertnet.com${productUrl}`

    const productRes = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(productUrl)}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!productRes.ok) return null

    return parsePhilibertHtml(await productRes.text())
  } catch {
    return null // non-fatal : le flux bascule sur Wikidata
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
  if (wikiTitle) {
    try {
      const summaryUrl =
        `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/` +
        encodeURIComponent(wikiTitle.replace(/ /g, '_'))
      const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(5000) })
      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json()
        if (summaryJson.extract) description = summaryJson.extract.slice(0, 2000)
      }
    } catch {}
  }

  // Image (P18 = fichier Wikimedia Commons)
  const imageFile = firstValue('P18')
  let image = null
  if (imageFile && typeof imageFile === 'string') {
    const filename = imageFile.replace(/ /g, '_')
    // L'API Commons renvoie une URL directe upload.wikimedia.org (CORS natif, pas de redirection)
    try {
      const imgApi =
        `https://commons.wikimedia.org/w/api.php?action=query` +
        `&titles=File:${encodeURIComponent(filename)}` +
        `&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
      const imgRes = await fetch(imgApi, { signal: AbortSignal.timeout(5000) })
      if (imgRes.ok) {
        const imgJson = await imgRes.json()
        const pages = Object.values(imgJson.query?.pages ?? {})
        const info = pages[0]?.imageinfo?.[0]
        image = info?.thumburl ?? info?.url ?? null
      }
    } catch {}
    if (!image) {
      image = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`
    }
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

export async function downloadBggCover(imageUrl) {
  // Wikimedia Commons supporte CORS — on essaie en direct d'abord
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const blob = await res.blob()
      const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0]
      return new File([blob], `cover.${ext}`, { type: blob.type || 'image/jpeg' })
    }
  } catch {}

  // Fallback via CF Worker (au cas où CORS bloqué)
  const proxyUrl = `${CF_WORKER}/?url=${encodeURIComponent(imageUrl)}`
  const res2 = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) })
  if (!res2.ok) throw new Error('Téléchargement de la couverture échoué')
  const blob2 = await res2.blob()
  const ext2 = (blob2.type.split('/')[1] || 'jpg').split('+')[0]
  return new File([blob2], `cover.${ext2}`, { type: blob2.type || 'image/jpeg' })
}
