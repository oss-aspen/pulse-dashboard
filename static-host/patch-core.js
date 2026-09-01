/**
 * Id matchers and source rewrites used by the static-host Vite plugin.
 */

import { STATIC_ENABLED_SLUGS } from './static-nav.js'

export { STATIC_ENABLED_SLUGS }

export function isBackendHealthModuleId(id) {
  const bare = String(id || '').split('?')[0].replace(/\\/g, '/')
  if (bare.includes('useBackendHealth-stub')) return false
  return /(?:^|\/)composables\/useBackendHealth(?:\.js)?$/.test(bare)
    || bare.includes('@shared/client/composables/useBackendHealth')
}

export function isCoreMainId(id) {
  const bare = String(id || '').split('?')[0].replace(/\\/g, '/')
  return bare.endsWith('/src/main.js')
}

export function isModuleLoaderId(id) {
  const bare = String(id || '').split('?')[0].replace(/\\/g, '/')
  return bare.endsWith('/src/module-loader.js')
}

export function isNavDiscoveryId(id) {
  return String(id || '').includes('virtual:nav-discovery')
}

/** Vite glob prefix that only matches STATIC_ENABLED_SLUGS. */
export function staticModuleGlobPrefix(slugs = STATIC_ENABLED_SLUGS) {
  if (slugs.length === 1) return `/modules/${slugs[0]}/`
  return `/modules/{${slugs.join(',')}}/`
}

/**
 * Narrow core's import.meta.glob('/modules/<slug>/...') so other modules
 * are not discovered or bundled.
 */
export function restrictModuleLoaderGlobs(code, slugs = STATIC_ENABLED_SLUGS) {
  if (!code.includes("'/modules/*/")) {
    throw new Error('[static-host] module-loader.js glob needle not found')
  }
  return code.replaceAll("'/modules/*/", `'${staticModuleGlobPrefix(slugs)}`)
}

export function filterNavDiscoveryModule(code, slugs = STATIC_ENABLED_SLUGS) {
  const prefix = 'export default '
  if (!code.startsWith(prefix)) return code
  const entries = JSON.parse(code.slice(prefix.length))
  if (!Array.isArray(entries)) return code
  const allowed = new Set(slugs)
  return prefix + JSON.stringify(entries.filter((e) => allowed.has(e.slug)))
}
