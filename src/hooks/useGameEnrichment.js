import { supabase } from '../lib/supabase'

export function cleanTitle(rawTitle) {
  if (!rawTitle) return ''
  // Take first segment before " - " or " – " (edition/publisher markers)
  let title = rawTitle.split(/\s[-–]\s/)[0].trim()
  // Remove trailing year in parens: "Catan (2015)"
  title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim()
  return title
}

export async function lookupUpc(ean) {
  const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`)
  if (res.status === 429) {
    const err = new Error('Quota UPCitemdb dépassé (100 req/jour). Saisis le titre manuellement.')
    err.code = 'quota_exceeded'
    throw err
  }
  if (!res.ok) {
    const err = new Error('Erreur lors de la recherche UPC.')
    err.code = 'upc_error'
    throw err
  }
  const data = await res.json()
  const title = data.items?.[0]?.title
  if (!title) {
    const err = new Error('Code-barres non reconnu dans la base UPCitemdb.')
    err.code = 'not_found'
    throw err
  }
  return title
}

export async function searchBgg(query) {
  const { data, error } = await supabase.functions.invoke('bgg-proxy', {
    body: { action: 'search', query },
  })
  if (error) throw new Error(error.message || 'Recherche BGG échouée')
  if (data?.error) throw new Error(data.error)
  return Array.isArray(data) ? data : []
}

export async function fetchBggThing(id) {
  const { data, error } = await supabase.functions.invoke('bgg-proxy', {
    body: { action: 'thing', id: String(id) },
  })
  if (error) throw new Error(error.message || 'Récupération BGG échouée')
  if (data?.error) throw new Error(data.error)
  return data
}

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
