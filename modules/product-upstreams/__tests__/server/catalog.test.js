import { describe, it, expect } from 'vitest'
import {
  getCatalog,
  getMeta,
  listProducts,
  getProduct,
  isValidProductId,
  searchPackages,
  getStats
} from '../../server/catalog.js'

describe('product-upstreams catalog', () => {
  it('loads the bundled catalog with origin metadata', () => {
    const catalog = getCatalog()
    expect(catalog.meta.stewardTeam).toBe('Red Hat AI Engineering')
    expect(catalog.meta.featureRequestUrl).toContain('github.com')
    expect(catalog.meta.customDataRequestUrl).toContain('custom%20data')
    expect(catalog.products.length).toBeGreaterThan(0)
  })

  it('lists products including grayed-out entries', () => {
    const products = listProducts()
    const available = products.filter(p => p.available)
    const grayed = products.filter(p => !p.available)
    expect(available.length).toBeGreaterThan(0)
    expect(grayed.length).toBeGreaterThan(0)
    expect(grayed.every(p => p.unavailableReason)).toBe(true)
  })

  it('returns a product with upstreams and packages', () => {
    const product = getProduct('rhaiis')
    expect(product.name).toMatch(/Inference/)
    expect(product.upstreams.length).toBeGreaterThan(0)
    expect(product.upstreams[0].packages[0].name).toBeTruthy()
    expect(product.upstreams[0].url).toMatch(/^https:\/\//)
  })

  it('rejects invalid product ids', () => {
    expect(isValidProductId('../etc/passwd')).toBe(false)
    expect(isValidProductId('RHAIIS')).toBe(false)
    expect(isValidProductId('rhaiis')).toBe(true)
    expect(getProduct('../secret')).toBeNull()
  })

  it('searches packages by name and includes product plus upstream URL', () => {
    const { results } = searchPackages('vllm')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toEqual(expect.objectContaining({
      name: expect.stringMatching(/vllm/i),
      version: expect.any(String),
      productName: expect.any(String),
      upstreamUrl: expect.stringMatching(/^https:\/\//)
    }))
  })

  it('does not return packages from grayed-out products', () => {
    const llama = getProduct('llama-stack')
    expect(llama.available).toBe(false)
    const { results } = searchPackages('llama')
    expect(results.every(r => r.productId !== 'llama-stack')).toBe(true)
  })

  it('returns no rows for an empty query', () => {
    expect(searchPackages('   ').results).toEqual([])
    expect(searchPackages('').query).toBe('')
  })

  it('reports catalog stats', () => {
    const stats = getStats()
    expect(stats.productCount).toBe(getCatalog().products.length)
    expect(stats.availableCount).toBeGreaterThan(0)
    expect(stats.listedUnavailableCount).toBeGreaterThan(0)
    expect(stats.packageCount).toBeGreaterThan(0)
    expect(getMeta().stewardTeam).toBe('Red Hat AI Engineering')
  })
})
