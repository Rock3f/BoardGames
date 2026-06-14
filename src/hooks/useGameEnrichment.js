import { supabase } from '../lib/supabase'

const BGG_API = 'https://boardgamegeek.com/xmlapi2'

const CF_WORKER = 'https://curly-smoke-29c7.badier-tanguy.workers.dev'

async function bggFetch(bggUrl) {
  const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(bggUrl)}`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`BGG error ${res.status}`)
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

// ── BGG search depuis le navigateur via proxy CORS ───────────────────────────

export async function searchBgg(query) {
  const bggUrl = `${BGG_API}/search?query=${encodeURIComponent(query)}&type=boardgame`
  const res = await bggFetch(bggUrl)
  const xml = await res.text()
  return parseBggSearch(xml)
}

function parseBggSearch(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  return Array.from(doc.querySelectorAll('item'))
    .slice(0, 15)
    .map((item) => {
      const primaryName =
        item.querySelector('name[type="primary"]')?.getAttribute('value') ??
        item.querySelector('name')?.getAttribute('value') ??
        ''
      return {
        id: item.getAttribute('id'),
        name: primaryName,
        yearPublished: item.querySelector('yearpublished')?.getAttribute('value') ?? null,
      }
    })
    .filter((g) => g.name)
}

// ── BGG thing depuis le navigateur via proxy CORS ────────────────────────────

export async function fetchBggThing(id) {
  const bggUrl = `${BGG_API}/thing?id=${encodeURIComponent(id)}&stats=1`
  const res = await bggFetch(bggUrl)
  const xml = await res.text()
  return parseBggThing(xml)
}

function parseBggThing(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const item = doc.querySelector('item')
  if (!item) throw new Error('Jeu non trouvé sur BGG')

  const primaryName =
    item.querySelector('name[type="primary"]')?.getAttribute('value') ??
    item.querySelector('name')?.getAttribute('value') ??
    ''

  let description = item.querySelector('description')?.textContent ?? ''
  description = description.replace(/&#10;/g, '\n').replace(/&#9;/g, '\t').trim().slice(0, 2000)

  const rawImage = item.querySelector('image')?.textContent?.trim() ?? ''
  const image = rawImage
    ? rawImage.startsWith('//')
      ? `https:${rawImage}`
      : rawImage
    : null

  function num(selector) {
    const v = item.querySelector(selector)?.getAttribute('value')
    return v ? Number(v) : null
  }

  return {
    name: primaryName,
    yearPublished: num('yearpublished'),
    minPlayers: num('minplayers'),
    maxPlayers: num('maxplayers'),
    minPlayTime: num('minplaytime'),
    maxPlayTime: num('maxplaytime'),
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
