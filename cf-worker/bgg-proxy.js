export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    }

    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('url')
    if (!targetUrl) return new Response('Missing url', { status: 400 })

    const target = new URL(targetUrl)
    if (
      !target.hostname.endsWith('boardgamegeek.com') &&
      !target.hostname.endsWith('geekdo.com') &&
      !target.hostname.endsWith('philibertnet.com') &&
      !target.hostname.endsWith('wikimedia.org')
    ) {
      return new Response('Forbidden', { status: 403 })
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'application/json, text/html, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        Origin: 'https://boardgamegeek.com',
        Referer: 'https://boardgamegeek.com/',
      },
    })

    const body = await response.arrayBuffer()
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  },
}
