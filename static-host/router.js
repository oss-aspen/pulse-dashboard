import { handleStaticApi } from './handlers.js'

function parseUrl(input, init) {
  const raw = typeof input === 'string' ? input : (input && input.url)
  const url = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  const method = (
    (init && init.method) ||
    (typeof input === 'object' && input && input.method) ||
    'GET'
  ).toUpperCase()
  return { url, method }
}

export function isApiRequest(input) {
  try {
    const { url } = parseUrl(input, null)
    return url.pathname === '/api' || url.pathname.startsWith('/api/')
  } catch {
    const raw = typeof input === 'string' ? input : ''
    return raw === '/api' || raw.startsWith('/api/') || raw.includes('/api/')
  }
}

export async function dispatchApi(input, init) {
  const { url, method } = parseUrl(input, init)
  return handleStaticApi(method, url.pathname, url.searchParams)
}

export function toResponse(result) {
  const body = result.body == null
    ? null
    : (typeof result.body === 'string' ? result.body : JSON.stringify(result.body))
  return new Response(body, {
    status: result.status || 200,
    headers: { 'Content-Type': result.contentType || 'application/json' }
  })
}
