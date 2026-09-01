import { describe, it, expect } from 'vitest'
import { handleStaticApi, STATIC_ENABLED_SLUGS, matchRoute, READ_ONLY } from '../handlers.js'
import { isApiRequest, dispatchApi } from '../router.js'

async function get(path) {
  return handleStaticApi('GET', path, new URLSearchParams())
}

describe('matchRoute', () => {
  it('extracts params', () => {
    expect(matchRoute('/modules/product-upstreams/products/rhoai', '/modules/product-upstreams/products/:id'))
      .toEqual({ id: 'rhoai' })
  })
  it('rejects length mismatch', () => {
    expect(matchRoute('/modules/product-upstreams/catalog', '/modules/product-upstreams/products/:id')).toBeNull()
  })
})

describe('handleStaticApi', () => {
  it('serves healthz', async () => {
    expect((await get('/api/healthz')).body).toEqual({ status: 'ok' })
  })

  it('leaves whoami unauthenticated so the shell hides login/user chrome', async () => {
    const who = await get('/api/whoami')
    expect(who.status).toBe(401)
  })

  it('enables only Product Upstreams in the shell', async () => {
    const state = await get('/api/built-in-modules/state')
    expect(state.body.enabledSlugs).toEqual(['product-upstreams'])
    expect(STATIC_ENABLED_SLUGS).toEqual(['product-upstreams'])
  })

  it('returns an empty roster instead of demo people', async () => {
    const res = await get('/api/roster')
    expect(res.status).toBe(200)
    expect(res.body.orgs).toEqual([])
  })

  it('returns product-upstreams catalog', async () => {
    const res = await get('/api/modules/product-upstreams/catalog')
    expect(res.status).toBe(200)
    expect(res.body.products.length).toBeGreaterThan(0)
  })

  it('returns a single product', async () => {
    const res = await get('/api/modules/product-upstreams/products/rhoai')
    expect(res.status).toBe(200)
    expect(res.body.product.id).toBe('rhoai')
  })

  it('no-ops writes', async () => {
    const res = await handleStaticApi('POST', '/api/refresh', new URLSearchParams())
    expect(res.status).toBe(200)
    expect(res.body).toEqual(READ_ONLY)
  })
})

describe('router', () => {
  it('detects /api urls', () => {
    expect(isApiRequest('/api/whoami')).toBe(true)
    expect(isApiRequest('http://localhost:5173/api/healthz')).toBe(true)
    expect(isApiRequest('/redhat-logo.svg')).toBe(false)
  })

  it('dispatches whoami as unauthenticated', async () => {
    const result = await dispatchApi('/api/whoami', { method: 'GET' })
    expect(result.status).toBe(401)
  })
})
