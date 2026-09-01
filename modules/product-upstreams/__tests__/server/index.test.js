import { describe, it, expect, vi } from 'vitest'

const registerRoutes = (await import('../../server/index.js')).default || (await import('../../server/index.js'))

function createRouter() {
  const routes = []
  return {
    routes,
    get: vi.fn((path, ...handlers) => {
      routes.push({ method: 'get', path, handler: handlers[handlers.length - 1] })
    })
  }
}

function createContext() {
  return {
    registerScopes: vi.fn(),
    registerDiagnostics: vi.fn(),
    requireScope: vi.fn(() => (req, res, next) => next())
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    }
  }
  return res
}

describe('product-upstreams server', () => {
  it('registers catalog, product, and search routes plus scopes', () => {
    const router = createRouter()
    const context = createContext()
    registerRoutes(router, context)

    const paths = router.routes.map(r => r.path)
    expect(paths).toContain('/catalog')
    expect(paths).toContain('/products/:id')
    expect(paths).toContain('/search')
    expect(context.registerScopes).toHaveBeenCalled()
    expect(context.registerDiagnostics).toHaveBeenCalledWith(expect.any(Function))
  })

  it('serves the bundled catalog', () => {
    const router = createRouter()
    registerRoutes(router, createContext())
    const handler = router.routes.find(r => r.path === '/catalog').handler
    const res = mockRes()
    handler({}, res)
    expect(res.body.meta.stewardTeam).toBe('Red Hat AI Engineering')
    expect(res.body.products.length).toBeGreaterThan(0)
  })

  it('returns 400 for an invalid product id and 404 for unknown ids', () => {
    const router = createRouter()
    registerRoutes(router, createContext())
    const handler = router.routes.find(r => r.path === '/products/:id').handler

    const bad = mockRes()
    handler({ params: { id: '../oops' } }, bad)
    expect(bad.statusCode).toBe(400)

    const missing = mockRes()
    handler({ params: { id: 'does-not-exist' } }, missing)
    expect(missing.statusCode).toBe(404)
  })

  it('returns a product payload for a known id', () => {
    const router = createRouter()
    registerRoutes(router, createContext())
    const handler = router.routes.find(r => r.path === '/products/:id').handler
    const res = mockRes()
    handler({ params: { id: 'rhoai' } }, res)
    expect(res.body.product.id).toBe('rhoai')
    expect(res.body.product.upstreams.length).toBeGreaterThan(0)
    expect(res.body.meta.stewardTeam).toBe('Red Hat AI Engineering')
  })

  it('requires a search query and returns package rows', () => {
    const router = createRouter()
    registerRoutes(router, createContext())
    const handler = router.routes.find(r => r.path === '/search').handler

    const missing = mockRes()
    handler({ query: {} }, missing)
    expect(missing.statusCode).toBe(400)

    const res = mockRes()
    handler({ query: { q: 'kserve' } }, res)
    expect(res.body.results.length).toBeGreaterThan(0)
    expect(res.body.results[0].upstreamUrl).toMatch(/^https:\/\//)
    expect(res.body.results[0].productName).toBeTruthy()
  })
})
