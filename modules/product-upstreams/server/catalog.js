const catalog = require('../data/catalog.json')

const PRODUCT_ID_RE = /^[a-z0-9][a-z0-9-]*$/
const MAX_QUERY_LENGTH = 200
const MAX_SEARCH_RESULTS = 100

function getCatalog() {
  return catalog
}

function getMeta() {
  return catalog.meta
}

function listProducts() {
  return (catalog.products || []).map(function(product) {
    const upstreams = product.upstreams || []
    let packageCount = 0
    for (const upstream of upstreams) {
      packageCount += (upstream.packages || []).length
    }
    return {
      id: product.id,
      name: product.name,
      shortName: product.shortName,
      description: product.description,
      category: product.category,
      version: product.version,
      available: product.available !== false,
      unavailableReason: product.unavailableReason || null,
      upstreamCount: upstreams.length,
      packageCount
    }
  })
}

function getProduct(id) {
  if (!id || !PRODUCT_ID_RE.test(id)) return null
  return (catalog.products || []).find(function(product) {
    return product.id === id
  }) || null
}

function isValidProductId(id) {
  return typeof id === 'string' && PRODUCT_ID_RE.test(id)
}

function searchPackages(rawQuery) {
  const query = String(rawQuery || '').trim().slice(0, MAX_QUERY_LENGTH).toLowerCase()
  if (!query) {
    return { query: '', results: [] }
  }

  const results = []
  for (const product of catalog.products || []) {
    if (product.available === false) continue
    for (const upstream of product.upstreams || []) {
      for (const pkg of upstream.packages || []) {
        const name = String(pkg.name || '')
        const version = String(pkg.version || '')
        if (!name.toLowerCase().includes(query) && !version.toLowerCase().includes(query)) {
          continue
        }
        results.push({
          name,
          version,
          productId: product.id,
          productName: product.name,
          upstreamName: upstream.name,
          upstreamUrl: upstream.url
        })
        if (results.length >= MAX_SEARCH_RESULTS) {
          return { query, results }
        }
      }
    }
  }
  return { query, results }
}

function getStats() {
  const products = catalog.products || []
  let packageCount = 0
  let upstreamCount = 0
  let availableCount = 0
  for (const product of products) {
    if (product.available !== false) availableCount++
    const upstreams = product.upstreams || []
    upstreamCount += upstreams.length
    for (const upstream of upstreams) {
      packageCount += (upstream.packages || []).length
    }
  }
  return {
    productCount: products.length,
    availableCount,
    listedUnavailableCount: products.length - availableCount,
    upstreamCount,
    packageCount,
    lastUpdated: catalog.meta && catalog.meta.lastUpdated
  }
}

module.exports = {
  PRODUCT_ID_RE,
  MAX_QUERY_LENGTH,
  MAX_SEARCH_RESULTS,
  getCatalog,
  getMeta,
  listProducts,
  getProduct,
  isValidProductId,
  searchPackages,
  getStats
}
