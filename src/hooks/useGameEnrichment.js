import { supabase } from '../lib/supabase'

const CF_WORKER = 'https://curly-smoke-29c7.badier-tanguy.workers.dev'

// Appel via CF Worker (ajoute les headers navigateur + CORS)
async function bggFetch(bggUrl) {
  const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(bggUrl)}`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BGG ${res.status}: ${body.slice(0, 200)}`)
  }
  return res
}

export function cleanTitle(rawTitle) {
  if (!rawTitle) return ''
  let title = rawTitle.split(/\s[-–]\s/)[0].trim()
  title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim()
  return title
}

// ── UPC lookup via edge function (UPCitemdb bloque CORS navigateur) ───────────

export async function lookupUpc(ean) {
  const { data, error } = await supabase.functions.invoke('bgg-proxy', {
    body: { action: 'upc', ean },
  })
  if (error) throw new Error(error.message || 'Erreur lors de la recherche UPC.')
  if (data?.error) throw new Error(data.error)
  return data.title
}

// ── BGG search via API interne geekdo.com (JSON) ─────────────────────────────

export async function searchBgg(query) {
  const url = `https://api.geekdo.com/api/search?q=${encodeURIComponent(query)}&objecttype=boardgame&nosession=1&showcount=25`
  const res = await bggFetch(url)
  const json = await res.json()

  return (json.items ?? [])
    .map((item) => ({
      id: String(item.objectid ?? item.id ?? ''),
      name: item.label ?? item.name?.value ?? item.originalname ?? '',
      yearPublished: item.yearpublished
        ? String(item.yearpublished?.value ?? item.yearpublished)
        : null,
    }))
    .filter((g) => g.id && g.name)
}

// ── BGG thing via API interne geekdo.com (JSON) ──────────────────────────────

export async function fetchBggThing(id) {
  const url = `https://api.geekdo.com/api/geekitems?nosession=1&objecttype=thing&objectid=${encodeURIComponent(id)}`
  const res = await bggFetch(url)
  const json = await res.json()

  // L'API peut retourner { item: {...} } ou { items: [...] }
  const item = json.item ?? json.items?.[0] ?? json

  function val(field) {
    const v = item[field]
    if (v == null) return null
    if (typeof v === 'object') return v.value ?? null
    return v
  }

  const rawImage = val('image') ?? item.images?.medium ?? item.thumbnail ?? null
  const image = rawImage
    ? rawImage.startsWith('//')
      ? `https:${rawImage}`
      : rawImage
    : null

  let description = val('description') ?? ''
  description = description.replace(/&#10;/g, '\n').replace(/&#9;/g, '\t').trim().slice(0, 2000)

  return {
    name: val('name') ?? '',
    yearPublished: val('yearpublished') ? Number(val('yearpublished')) : null,
    minPlayers: val('minplayers') ? Number(val('minplayers')) : null,
    maxPlayers: val('maxplayers') ? Number(val('maxplayers')) : null,
    minPlayTime: val('minplaytime') ? Number(val('minplaytime')) : null,
    maxPlayTime: val('maxplaytime') ? Number(val('maxplaytime')) : null,
    description,
    image,
  }
}

// ── Cover BGG via edge function (cf.geekdo-images.com bloque CORS) ───────────

export async function downloadBggCover(imageUrl) {
  const { data, error } = await supabase.functions.invoke('bgg-proxy', {
    body: { action: 'image', url: imageUrl },
  })
  if (error || data?.error) throw new Error('Téléchargement de la couverture échoué')

  const binary = atob(data.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: data.contentType })
  const ext = data.contentType.split('/')[1]?.split('+')[0] ?? 'jpg'
  return new File([blob], `bgg-cover.${ext}`, { type: data.contentType })
}
