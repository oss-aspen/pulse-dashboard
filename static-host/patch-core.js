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

export function isLandingPageId(id) {
  const [bare, query] = String(id || '').replace(/\\/g, '/').split('?')
  if (query) return false
  return bare.endsWith('/components/LandingPage.vue')
}

/** Raw core App.vue SFC only — skip Vue compiler sub-requests (`?vue&type=...`). */
export function isCoreAppVueId(id) {
  const [bare, query] = String(id || '').replace(/\\/g, '/').split('?')
  if (query) return false
  return bare.endsWith('/src/components/App.vue')
}

const AUTH_GATED_RESTORE = `    await this.loadBuiltInManifestsFromApi()
    if (this.authUser) {
      await this.loadInitialData()
    }
`

const UNAUTH_RESTORE = `    await this.loadBuiltInManifestsFromApi()
    if (this.authUser) {
      await this.loadInitialData()
    } else {
      // Static host (and local without a session) never sets authUser, but hash
      // routes still need to mount. Otherwise a deep link shows Home and a
      // second click on the already-current hash leaves the main pane blank.
      await this.restoreFromHash()
    }
`

const SIDEBAR_HASH_ONLY = `        this.activeModuleSlugRef = manifest.slug
        this.activeModule = manifest.slug
        this.activeViewId = resolvedViewId
        this.routeParams = {}
        window.location.hash = \`#/\${manifest.slug}/\${resolvedViewId}\`
        return
`

const SIDEBAR_SAME_HASH_LOAD = `        this.activeModuleSlugRef = manifest.slug
        this.activeModule = manifest.slug
        this.activeViewId = resolvedViewId
        this.routeParams = {}
        const nextHash = \`#/\${manifest.slug}/\${resolvedViewId}\`
        if ((window.location.hash || '#/') === nextHash) {
          this.loadModuleView(manifest.slug, resolvedViewId)
        } else {
          window.location.hash = nextHash
        }
        return
`

function mustReplace(code, needle, replacement, label) {
  if (!code.includes(needle)) {
    throw new Error(`[static-host] ${label}: needle not found — core App.vue may have changed`)
  }
  return code.replace(needle, replacement)
}

/**
 * Core only restores the hash after whoami succeeds. Static /api/whoami is 401
 * on purpose (hide user chrome), so deep links never mount, and clicking the
 * current Products nav item does not fire hashchange — main stays blank.
 */
export function patchAppHashNavigation(code) {
  let next = mustReplace(code, AUTH_GATED_RESTORE, UNAUTH_RESTORE, 'unauthenticated hash restore')
  next = mustReplace(next, SIDEBAR_HASH_ONLY, SIDEBAR_SAME_HASH_LOAD, 'same-hash sidebar navigation')
  return next
}

export function stripLandingPageApiDocs(code) {
  const utilitiesBlock = `      <!-- Utilities -->
      <div class="mb-8">
        <p class="px-1 mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Utilities
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener"
            class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            <div class="flex items-start gap-3">
              <div class="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
                <FileCode2 :size="20" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">API Docs</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Interactive OpenAPI documentation for all API endpoints</p>
              </div>
            </div>
          </a>
        </div>
      </div>
`
  if (!code.includes(utilitiesBlock)) {
    throw new Error('[static-host] LandingPage.vue API Docs block not found')
  }
  return code.replace(utilitiesBlock, '').replace('  FileCode2,\n', '')
}

export function filterNavDiscoveryModule(code, slugs = STATIC_ENABLED_SLUGS) {
  const prefix = 'export default '
  if (!code.startsWith(prefix)) return code
  const entries = JSON.parse(code.slice(prefix.length))
  if (!Array.isArray(entries)) return code
  const allowed = new Set(slugs)
  return prefix + JSON.stringify(entries.filter((e) => allowed.has(e.slug)))
}
