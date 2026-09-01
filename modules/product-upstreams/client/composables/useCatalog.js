import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const MODULE_API = '/modules/product-upstreams'

const catalog = ref(null)
const loading = ref(false)
const error = ref(null)
let hasFetched = false
let inflight = null

async function loadCatalog() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest(`${MODULE_API}/catalog`)
    catalog.value = data
    hasFetched = true
    return data
  } catch (err) {
    error.value = err.message || 'Failed to load catalog'
    throw err
  } finally {
    loading.value = false
    inflight = null
  }
}

function ensureLoaded() {
  if (hasFetched || inflight) return inflight
  inflight = loadCatalog().catch(function() {
    hasFetched = false
  })
  return inflight
}

function searchPackages(rawQuery) {
  const query = String(rawQuery || '').trim().toLowerCase()
  if (!query || !catalog.value) return []
  const results = []
  for (const product of catalog.value.products || []) {
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
      }
    }
  }
  return results
}

function findProduct(id) {
  if (!catalog.value || !id) return null
  return (catalog.value.products || []).find(function(product) {
    return product.id === id
  }) || null
}

export function useCatalog() {
  ensureLoaded()
  return {
    catalog,
    loading,
    error,
    loadCatalog,
    searchPackages,
    findProduct
  }
}

export function _resetForTesting() {
  catalog.value = null
  loading.value = false
  error.value = null
  hasFetched = false
  inflight = null
}
