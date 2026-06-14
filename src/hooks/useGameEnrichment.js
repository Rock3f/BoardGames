import { supabase } from '../lib/supabase'

const CF_WORKER = 'https://curly-smoke-29c7.badier-tanguy.workers.dev'
// API v1 (plus ancienne, restrictions OAuth différentes de v2)
const BGG_V1 = 'https://www.boardgamegeek.com/xmlapi'

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

// ── UPC lookup via edge function ──────────────────────────────────────────────

export async function lookupUpc(ean) {
  const { data, error } = await supabase.functions.invoke('bgg-proxy', {
    body: { action: 'upc', ean },
  })
  if (error) throw new Error(error.message || 'Erreur lors de la recherche UPC.')
  if (data?.error) throw new Error(data.error)
  return data.title
}

// ── BGG search via XML API v1 ─────────────────────────────────────────────────
// v1 : <boardgames><boardgame objectid="13"><name primary="true">Catan</name>...

export async function searchBgg(query) {
  const url = `${BGG_V1}/search?search=${encodeURIComponent(query)}`
  const res = await bggFetch(url)
  const xml = await res.text()
  return parseBggV1Search(xml)
}

function parseBggV1Search(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  return Array.from(doc.querySelectorAll('boardgame'))
    .slice(0, 15)
    .map((el) => {
      const primaryName =
        el.querySelector('name[primary="true"]')?.textContent ??
        el.querySelector('name')?.textContent ??
        ''
      const year = el.querySelector('yearpublished')?.textContent ?? null
      return {
        id: el.getAttribute('objectid') ?? '',
        name: primaryName.trim(),
        yearPublished: year && year !== '0' ? year : null,
      }
    })
    .filter((g) => g.id && g.name)
}

// ── BGG thing via XML API v1 ──────────────────────────────────────────────────
// v1 : <boardgames><boardgame objectid="13"><yearpublished>1995</yearpublished>...

export async function fetchBggThing(id) {
  const url = `${BGG_V1}/boardgame/${encodeURIComponent(id)}?stats=1`
  const res = await bggFetch(url)
  const xml = await res.text()
  return parseBggV1Thing(xml)
}

function parseBggV1Thing(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const item = doc.querySelector('boardgame')
  if (!item) throw new Error('Jeu non trouvé sur BGG')

  const primaryName =
    item.querySelector('name[primary="true"]')?.textContent ??
    item.querySelector('name')?.textContent ??
    ''

  function txt(selector) {
    return item.querySelector(selector)?.textContent?.trim() ?? null
  }
  function num(selector) {
    const v = txt(selector)
    return v && v !== '0' ? Number(v) : null
  }

  let description = txt('description') ?? ''
  description = description.replace(/&#10;/g, '\n').replace(/&#9;/g, '\t').trim().slice(0, 2000)

  const rawImage = txt('image') ?? ''
  const image = rawImage
    ? rawImage.startsWith('//')
      ? `https:${rawImage}`
      : rawImage
    : null

  return {
    name: primaryName.trim(),
    yearPublished: num('yearpublished'),
    minPlayers: num('minplayers'),
    maxPlayers: num('maxplayers'),
    minPlayTime: num('minplaytime'),
    maxPlayTime: num('maxplaytime'),
    description,
    image,
  }
}

// ── Cover BGG via edge function ───────────────────────────────────────────────

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
