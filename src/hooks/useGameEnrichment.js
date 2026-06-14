import { supabase } from '../lib/supabase'

const WD_API = 'https://www.wikidata.org/w/api.php'
const CF_WORKER = 'https://curly-smoke-29c7.badier-tanguy.workers.dev'

export function cleanTitle(rawTitle) {
  if (!rawTitle) return ''
  let title = rawTitle.split(/\s[-–]\s/)[0].trim()
  title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim()
  return title
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

export async function searchBgg(query) {
  const url =
    `${WD_API}?action=wbsearchentities` +
    `&search=${encodeURIComponent(query)}` +
    `&language=fr&format=json&type=item&limit=20&origin=*`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Recherche Wikidata échouée (${res.status})`)
  const json = await res.json()

  return (json.search ?? [])
    .map((item) => ({
      id: item.id,
      name: item.label ?? '',
      yearPublished: null,
      description: item.description ?? '',
    }))
    .filter((g) => g.id && g.name)
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

  // Durée (P2047, en minutes) — même format quantity
  const duration = numProp('P2047')

  // Description courte (FR puis EN)
  let description =
    entity.descriptions?.fr?.value ?? entity.descriptions?.en?.value ?? ''

  // Image (P18 = fichier Wikimedia Commons)
  const imageFile = firstValue('P18')
  let image = null
  if (imageFile && typeof imageFile === 'string') {
    const filename = imageFile.replace(/ /g, '_')
    image = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`
  }

  return {
    name,
    yearPublished,
    minPlayers: numProp('P1872'),
    maxPlayers: numProp('P1873'),
    minPlayTime: duration,
    maxPlayTime: duration,
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
