/**
 * Static API for a read-only catalog site (e.g. Product Upstreams).
 *
 * Platform calls from @org-pulse/core still fire on boot (roster, whoami, …).
 * We answer them with empty/unauthenticated stubs so the shell does not show
 * login, Settings, or Refresh. Other modules are omitted from the Vite glob.
 */

import {
  getCatalog,
  getProduct,
  isValidProductId,
  searchPackages
} from '../modules/product-upstreams/server/catalog.js'
import { STATIC_ENABLED_SLUGS } from './static-nav.js'

export { STATIC_ENABLED_SLUGS }

const READ_ONLY = { status: 'skipped', message: 'Static site is read-only' }
const EMPTY_ROSTER = {
  orgs: [],
  teamDataSource: 'in-app',
  visibleFields: [],
  primaryDisplayField: null
}

function json(status, body) {
  return { status, body, contentType: 'application/json' }
}

function matchRoute(path, pattern) {
  const pSeg = pattern.split('/').filter(Boolean)
  const aSeg = path.split('/').filter(Boolean)
  if (pSeg.length !== aSeg.length) return null
  const params = {}
  for (let i = 0; i < pSeg.length; i++) {
    if (pSeg[i].startsWith(':')) {
      params[pSeg[i].slice(1)] = aSeg[i]
    } else if (pSeg[i] !== aSeg[i]) {
      return null
    }
  }
  return params
}

function handleProductUpstreams(path, query) {
  if (path === '/modules/product-upstreams/catalog') {
    return json(200, getCatalog())
  }
  if (path === '/modules/product-upstreams/search') {
    const q = query.get('q')
    if (!q || !String(q).trim()) {
      return json(400, { error: 'Query parameter "q" is required' })
    }
    return json(200, searchPackages(q))
  }
  const params = matchRoute(path, '/modules/product-upstreams/products/:id')
  if (params) {
    if (!isValidProductId(params.id)) return json(400, { error: 'Invalid product id' })
    const product = getProduct(params.id)
    if (!product) return json(404, { error: 'Product not found' })
    return json(200, { meta: getCatalog().meta, product })
  }
  return null
}

function handlePlatform(path) {
  if (path === '/healthz') return json(200, { status: 'ok' })

  // 401 → useAuth leaves user=null → no sidebar user/login chip, no API Tokens,
  // no Settings (admin-only), no Refresh (admin-only). App.vue hash restore for
  // that unauthenticated case is patched in static-host/patch-core.js.
  if (path === '/whoami') {
    return json(401, { error: 'Authentication required.' })
  }

  if (path === '/site-config') return json(200, { titlePrefix: '' })
  if (path === '/last-refreshed') return json(200, { timestamp: null })
  if (path === '/roster' || path === '/modules/team-tracker/roster') {
    return json(200, EMPTY_ROSTER)
  }
  if (path === '/messages') return json(200, [])
  if (path === '/search-index') return json(200, [])
  if (path === '/modules') return json(200, { modules: [] })
  if (path === '/built-in-modules/state') {
    return json(200, { enabledSlugs: STATIC_ENABLED_SLUGS.slice() })
  }
  if (path === '/built-in-modules/manifests') return json(200, { modules: [] })
  if (path === '/github/contributions' || path === '/gitlab/contributions') {
    return json(200, { users: {} })
  }
  if (path === '/people/metrics' || path === '/modules/team-tracker/people/metrics') {
    return json(200, {})
  }
  if (path === '/roles/me' || path === '/roles/available') return json(200, { roles: [] })
  if (path === '/health-metrics/tracking/status') return json(200, { optedOut: true })
  if (path === '/modules/team-tracker/permissions/me') {
    return json(200, { roles: [], isManager: false, uid: null, managedUids: [] })
  }

  return null
}

export async function handleStaticApi(method, pathname, searchParams) {
  const path = pathname.replace(/^\/api/, '') || '/'
  const query = searchParams || new URLSearchParams()

  if (method !== 'GET' && method !== 'HEAD') {
    return json(200, READ_ONLY)
  }

  const platform = handlePlatform(path)
  if (platform) return platform

  if (path.startsWith('/modules/product-upstreams/')) {
    const hit = handleProductUpstreams(path, query)
    if (hit) return hit
  }

  return json(200, {})
}

export { json, matchRoute, READ_ONLY }
