/**
 * Convert Fedora/Hummingbird sidecar records into a Product Upstreams
 * catalog product (grouped by upstream_repo).
 */

function unwrapSidecar(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  if (record.sidecar && typeof record.sidecar === 'object') return record.sidecar
  if (record.Package || record.package || record.upstream_repo || record.source) {
    return record
  }
  return null
}

function collectSidecars(input) {
  if (input == null) return []
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return []
    try {
      return collectSidecars(JSON.parse(trimmed))
    } catch {
      const records = []
      for (const line of trimmed.split('\n')) {
        const row = line.trim()
        if (!row) continue
        records.push(...collectSidecars(JSON.parse(row)))
      }
      return records
    }
  }
  if (Array.isArray(input)) {
    return input.flatMap(collectSidecars)
  }
  if (Array.isArray(input.packages)) return collectSidecars(input.packages)
  if (Array.isArray(input.sidecars)) return collectSidecars(input.sidecars)
  if (Array.isArray(input.records)) return collectSidecars(input.records)
  const sidecar = unwrapSidecar(input)
  return sidecar ? [sidecar] : []
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function normalizeRepoUrl(url) {
  if (!url || typeof url !== 'string') return ''
  return url.trim().replace(/\.git$/i, '').replace(/\/+$/, '')
}

function repoPathParts(url) {
  try {
    const parsed = new URL(url)
    return parsed.pathname.replace(/\.git$/i, '').split('/').filter(Boolean)
  } catch {
    return []
  }
}

function upstreamIdFromUrl(url, packageName) {
  const parts = repoPathParts(url)
  if (parts.length >= 2) {
    const last = slugify(parts[parts.length - 1])
    if (last) return last
  }
  if (parts.length === 1) {
    const last = slugify(parts[0])
    if (last) return last
  }
  const fromPackage = slugify(packageName)
  return fromPackage || 'unknown'
}

function upstreamNameFromUrl(url, packageName) {
  const parts = repoPathParts(url)
  if (parts.length) return parts[parts.length - 1]
  return packageName || url || 'Unknown'
}

function uniqueId(base, used) {
  let id = base || 'unknown'
  if (!used.has(id)) {
    used.add(id)
    return id
  }
  let n = 2
  while (used.has(`${id}-${n}`)) n++
  const next = `${id}-${n}`
  used.add(next)
  return next
}

function packageNameOf(sidecar) {
  return String(sidecar.Package || sidecar.package || sidecar.name || '').trim()
}

function buildHummingbirdProduct(input, options = {}) {
  const sidecars = collectSidecars(input)
  const groups = new Map()

  for (const sidecar of sidecars) {
    const name = packageNameOf(sidecar)
    if (!name) continue
    const url = normalizeRepoUrl(sidecar.upstream_repo)
    const key = url || `package:${name.toLowerCase()}`
    if (!groups.has(key)) {
      groups.set(key, {
        url,
        packages: new Map()
      })
    }
    const version = sidecar.version != null ? String(sidecar.version) : ''
    groups.get(key).packages.set(name, { name, version })
  }

  const usedIds = new Set()
  const upstreams = [...groups.entries()]
    .map(([, group]) => {
      const sampleName = [...group.packages.values()][0]?.name || ''
      const url = group.url || null
      const idBase = url
        ? upstreamIdFromUrl(url, sampleName)
        : (slugify(sampleName) || 'unmapped')
      return {
        id: uniqueId(idBase, usedIds),
        name: url ? upstreamNameFromUrl(url, sampleName) : sampleName,
        url: url || '',
        description: url
          ? `Upstream repository for ${[...group.packages.values()].map(p => p.name).join(', ')}.`
          : 'No upstream_repo was provided for this package.',
        packages: [...group.packages.values()].sort((a, b) => a.name.localeCompare(b.name))
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const branches = sidecars.map(s => s.branch).filter(Boolean)
  const uniqueBranches = [...new Set(branches)]
  const version = options.version
    || (uniqueBranches.length === 1 ? uniqueBranches[0] : null)

  return {
    id: options.id || 'hummingbird',
    name: options.name || 'Hummingbird',
    shortName: options.shortName || 'Hummingbird',
    description: options.description
      || 'Fedora Hummingbird image packages mapped to their upstream repositories.',
    category: options.category || 'Platform',
    version,
    available: true,
    upstreams
  }
}

function mergeProductIntoCatalog(catalog, product) {
  const next = {
    ...catalog,
    products: [...(catalog.products || [])]
  }
  const index = next.products.findIndex(p => p.id === product.id)
  if (index >= 0) next.products[index] = product
  else next.products.push(product)
  if (next.meta && typeof next.meta === 'object') {
    next.meta = {
      ...next.meta,
      lastUpdated: new Date().toISOString().slice(0, 10)
    }
  }
  return next
}

module.exports = {
  unwrapSidecar,
  collectSidecars,
  slugify,
  normalizeRepoUrl,
  buildHummingbirdProduct,
  mergeProductIntoCatalog
}
