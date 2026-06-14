// @ts-nocheck
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.4.1'

const BGG_API = 'https://boardgamegeek.com/xmlapi2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['item', 'name'].includes(name),
})

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function fetchBgg(url, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url)
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
      continue
    }
    if (!res.ok) throw new Error(`BGG API error ${res.status}`)
    return res.text()
  }
  throw new Error('BGG API timeout après plusieurs tentatives')
}

async function handleSearch(query) {
  const xml = await fetchBgg(
    `${BGG_API}/search?query=${encodeURIComponent(query)}&type=boardgame`,
  )
  const parsed = parser.parse(xml)
  const items = parsed?.items?.item ?? []

  return items
    .slice(0, 15)
    .map((item) => {
      const names = item.name ?? []
      const primaryName =
        names.find((n) => n['@_type'] === 'primary')?.['@_value'] ??
        names[0]?.['@_value'] ??
        ''
      return {
        id: String(item['@_id']),
        name: primaryName,
        yearPublished: item.yearpublished?.['@_value'] ?? null,
      }
    })
    .filter((g) => g.name)
}

async function handleThing(id) {
  const xml = await fetchBgg(`${BGG_API}/thing?id=${encodeURIComponent(id)}&stats=1`)
  const parsed = parser.parse(xml)
  const item = parsed?.items?.item?.[0]
  if (!item) throw new Error('Jeu non trouvé sur BGG')

  const names = item.name ?? []
  const primaryName =
    names.find((n) => n['@_type'] === 'primary')?.['@_value'] ??
    names[0]?.['@_value'] ??
    ''

  let description = String(item.description ?? '')
  description = description
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, '\n')
    .replace(/&#9;/g, '\t')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, 2000)

  const rawImage = String(item.image ?? '')
  const image = rawImage
    ? rawImage.startsWith('//')
      ? `https:${rawImage}`
      : rawImage
    : null

  return {
    name: primaryName,
    yearPublished: item.yearpublished?.['@_value']
      ? Number(item.yearpublished['@_value'])
      : null,
    minPlayers: item.minplayers?.['@_value'] ? Number(item.minplayers['@_value']) : null,
    maxPlayers: item.maxplayers?.['@_value'] ? Number(item.maxplayers['@_value']) : null,
    minPlayTime: item.minplaytime?.['@_value'] ? Number(item.minplaytime['@_value']) : null,
    maxPlayTime: item.maxplaytime?.['@_value'] ? Number(item.maxplaytime['@_value']) : null,
    description,
    image,
  }
}

async function handleUpc(ean) {
  const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(ean)}`)
  if (res.status === 429) throw new Error('Quota UPCitemdb dépassé (100 req/jour). Saisis le titre manuellement.')
  if (!res.ok) throw new Error(`UPCitemdb error ${res.status}`)
  const data = await res.json()
  const title = data.items?.[0]?.title
  if (!title) throw new Error('Code-barres non reconnu dans la base UPCitemdb.')
  return { title }
}

async function handleImage(url) {
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    throw new Error('URL image invalide')
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Téléchargement image échoué: ${res.status}`)

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  const contentType = res.headers.get('content-type') || 'image/jpeg'

  return { base64, contentType }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json()
    const { action } = body

    if (action === 'upc') {
      if (!body.ean) throw new Error('ean est requis')
      const result = await handleUpc(String(body.ean))
      return jsonResponse(result)
    }

    if (action === 'search') {
      if (!body.query) throw new Error('query est requis')
      const result = await handleSearch(String(body.query))
      return jsonResponse(result)
    }

    if (action === 'thing') {
      if (!body.id) throw new Error('id est requis')
      const result = await handleThing(String(body.id))
      return jsonResponse(result)
    }

    if (action === 'image') {
      if (!body.url) throw new Error('url est requis')
      const result = await handleImage(String(body.url))
      return jsonResponse(result)
    }

    throw new Error(`Action inconnue: ${action}`)
  } catch (err) {
    return jsonResponse({ error: err?.message ?? 'Erreur inconnue' })
  }
})
