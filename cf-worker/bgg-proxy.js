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
    const isPhilibert = target.hostname.endsWith('philibertnet.com')
    const isWikimedia = target.hostname.endsWith('wikimedia.org')
    const isBgg =
      target.hostname.endsWith('boardgamegeek.com') ||
      target.hostname.endsWith('geekdo.com')

    if (!isPhilibert && !isWikimedia && !isBgg) {
      return new Response('Forbidden', { status: 403 })
    }

    const isImage = /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i.test(target.pathname)

    const fetchHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: isImage
        ? 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    }

    if (isPhilibert) {
      // Headers qui ressemblent à une navigation interne sur Philibert
      fetchHeaders['Referer'] = 'https://www.philibertnet.com/fr/'
      fetchHeaders['Sec-Fetch-Site'] = 'same-origin'
      fetchHeaders['Sec-Fetch-Mode'] = isImage ? 'no-cors' : 'navigate'
      fetchHeaders['Sec-Fetch-Dest'] = isImage ? 'image' : 'document'
    } else if (isBgg) {
      fetchHeaders['Origin'] = 'https://boardgamegeek.com'
      fetchHeaders['Referer'] = 'https://boardgamegeek.com/'
    }

    const response = await fetch(targetUrl, { headers: fetchHeaders })

    const body = await response.arrayBuffer()
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') ||
          (isImage ? 'image/jpeg' : 'text/html; charset=utf-8'),
        'Access-Control-Allow-Origin': '*',
      },
    })
  },
}
