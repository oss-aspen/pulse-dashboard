import { describe, it, expect } from 'vitest'
import { handleStaticApi, STATIC_ENABLED_SLUGS, matchRoute, READ_ONLY } from '../handlers.js'
import { isApiRequest, dispatchApi } from '../router.js'
import { deriveRoster } from '../roster.js'
import { readFromStorage } from '../fixtures.js'

async function get(path) {
  return handleStaticApi('GET', path, new URLSearchParams())
}

describe('matchRoute', () => {
  it('extracts params', () => {
    expect(matchRoute('/modules/releases/registry/rhai-3.5-ea1', '/modules/releases/registry/:id'))
      .toEqual({ id: 'rhai-3.5-ea1' })
  })
  it('rejects length mismatch', () => {
    expect(matchRoute('/modules/releases/registry', '/modules/releases/registry/:id')).toBeNull()
  })
})

describe('static fixtures', () => {
  it('loads core team-data registry', () => {
    const registry = readFromStorage('team-data/registry.json')
    expect(registry?.people?.achen?.name).toBe('Alice Chen')
  })
  it('loads local ai-impact rfe data', () => {
    const data = readFromStorage('ai-impact/rfe-data.json')
    expect(Array.isArray(data?.issues)).toBe(true)
  })
})

describe('deriveRoster', () => {
  it('builds in-app orgs from demo registry', () => {
    const roster = deriveRoster()
    expect(roster.teamDataSource).toBe('in-app')
    expect(roster.orgs.length).toBeGreaterThan(0)
    expect(roster.orgs.some(o => o.key === 'achen')).toBe(true)
  })
})

describe('handleStaticApi', () => {
  it('serves healthz and whoami without admin', async () => {
    expect((await get('/api/healthz')).body).toEqual({ status: 'ok' })
    const who = await get('/api/whoami')
    expect(who.status).toBe(200)
    expect(who.body.isAdmin).toBe(false)
    expect(who.body.email).toBe('public@example.com')
  })

  it('enables built-in modules except live proxies', async () => {
    const state = await get('/api/built-in-modules/state')
    expect(state.body.enabledSlugs).toEqual(STATIC_ENABLED_SLUGS)
    expect(state.body.enabledSlugs).not.toContain('upstream-pulse')
  })

  it('returns roster orgs', async () => {
    const res = await get('/api/roster')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.orgs)).toBe(true)
    expect(res.body.orgs.length).toBeGreaterThan(0)
  })

  it('returns product-upstreams catalog', async () => {
    const res = await get('/api/modules/product-upstreams/catalog')
    expect(res.status).toBe(200)
    expect(res.body.products.length).toBeGreaterThan(0)
  })

  it('returns quality report list projection', async () => {
    const res = await get('/api/modules/system-health/quality/reports')
    expect(res.status).toBe(200)
    expect(res.body.reports['kserve--kserve']).toBeTruthy()
    expect(res.body.reports['kserve--kserve'].overallScore).toBeTypeOf('number')
  })

  it('returns execution feature index', async () => {
    const res = await get('/api/modules/releases/execution/features')
    expect(res.status).toBe(200)
    expect(res.body.featureCount).toBeGreaterThan(0)
  })

  it('returns a single execution feature file', async () => {
    const res = await get('/api/modules/releases/execution/features/TEST1-99')
    expect(res.status).toBe(200)
    expect(res.body.key).toBe('TEST1-99')
  })

  it('no-ops writes', async () => {
    const res = await handleStaticApi('POST', '/api/refresh', new URLSearchParams())
    expect(res.status).toBe(200)
    expect(res.body).toEqual(READ_ONLY)
  })

  it('stubs upstream-pulse as unavailable', async () => {
    const res = await get('/api/modules/upstream-pulse/dashboard')
    expect(res.status).toBe(502)
  })
})

describe('router', () => {
  it('detects /api urls', () => {
    expect(isApiRequest('/api/whoami')).toBe(true)
    expect(isApiRequest('http://localhost:5173/api/healthz')).toBe(true)
    expect(isApiRequest('/redhat-logo.svg')).toBe(false)
  })

  it('dispatches whoami', async () => {
    const result = await dispatchApi('/api/whoami', { method: 'GET' })
    expect(result.body.displayName).toBe('Public viewer')
  })
})
