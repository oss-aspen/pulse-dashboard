/**
 * Client-side demo storage: eager-load fixture JSON from this repo and core.
 * Local fixtures override core files with the same relative key.
 */

const localFiles = import.meta.glob('../fixtures/**/*.json', {
  eager: true,
  import: 'default'
})
const coreFiles = import.meta.glob('../node_modules/@org-pulse/core/fixtures/**/*.json', {
  eager: true,
  import: 'default'
})

function stripPrefix(globKey, prefix) {
  const idx = globKey.indexOf(prefix)
  if (idx === -1) return null
  return globKey.slice(idx + prefix.length)
}

const store = new Map()

for (const [globKey, data] of Object.entries(coreFiles)) {
  const rel = stripPrefix(globKey, '/fixtures/')
  if (rel) store.set(rel, data)
}
for (const [globKey, data] of Object.entries(localFiles)) {
  const rel = stripPrefix(globKey, '/fixtures/')
  if (rel) store.set(rel, data)
}

export function readFromStorage(key) {
  if (!key || typeof key !== 'string') return null
  if (store.has(key)) return store.get(key)
  return null
}

export function listStorageFiles(dir) {
  const prefix = dir.endsWith('/') ? dir : dir + '/'
  const names = []
  for (const key of store.keys()) {
    if (!key.startsWith(prefix)) continue
    const rest = key.slice(prefix.length)
    if (!rest || rest.includes('/')) continue
    names.push(rest)
  }
  return names
}

export function hasStorageKey(key) {
  return store.has(key)
}

export function storageKeys() {
  return [...store.keys()]
}
