import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import {
  isBackendHealthModuleId,
  isCoreMainId,
  isModuleLoaderId,
  isNavDiscoveryId,
  staticModuleGlobPrefix,
  restrictModuleLoaderGlobs,
  filterNavDiscoveryModule,
  isLandingPageId,
  isCoreAppVueId,
  stripLandingPageApiDocs,
  patchAppHashNavigation
} from '../patch-core.js'
import { stripCommandPalette } from '../../build/disable-command-palette.js'

const require = createRequire(import.meta.url)

describe('isBackendHealthModuleId', () => {
  it('matches aliased and filesystem ids, including missing .js', () => {
    expect(isBackendHealthModuleId('@shared/client/composables/useBackendHealth')).toBe(true)
    expect(isBackendHealthModuleId('@shared/client/composables/useBackendHealth.js')).toBe(true)
    expect(isBackendHealthModuleId('/core/shared/client/composables/useBackendHealth')).toBe(true)
    expect(isBackendHealthModuleId('/core/shared/client/composables/useBackendHealth.js?t=1')).toBe(true)
  })

  it('ignores the stub itself', () => {
    expect(isBackendHealthModuleId('/static-host/useBackendHealth-stub.js')).toBe(false)
  })
})

describe('isCoreMainId', () => {
  it('matches core main.js', () => {
    expect(isCoreMainId('/x/src/main.js')).toBe(true)
    expect(isCoreMainId('/x/src/main.js?t=1')).toBe(true)
    expect(isCoreMainId('/x/src/App.vue')).toBe(false)
  })
})

describe('restrictModuleLoaderGlobs', () => {
  it('rewrites core globs to only the static module', () => {
    expect(isModuleLoaderId('/core/src/module-loader.js')).toBe(true)
    expect(staticModuleGlobPrefix(['product-upstreams'])).toBe('/modules/product-upstreams/')
    const source = [
      "const manifestModules = import.meta.glob('/modules/*/module.json', { eager: true })",
      "const clientEntries = import.meta.glob('/modules/*/client/index.js')"
    ].join('\n')
    const next = restrictModuleLoaderGlobs(source, ['product-upstreams'])
    expect(next).toContain("'/modules/product-upstreams/module.json'")
    expect(next).toContain("'/modules/product-upstreams/client/index.js'")
    expect(next).not.toContain("'/modules/*/")
  })
})

describe('stripLandingPageApiDocs', () => {
  it('removes the Utilities / API Docs card', () => {
    expect(isLandingPageId('/core/src/components/LandingPage.vue')).toBe(true)
    expect(isLandingPageId('/core/src/components/LandingPage.vue?vue&type=template')).toBe(false)
    const source = `      <!-- Built-in Modules -->
      <div></div>

      <!-- Utilities -->
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

      <!-- External Modules -->
      <div></div>
import {
  FileText,
  FileCode2,
  PieChart
}`
    const next = stripLandingPageApiDocs(source)
    expect(next).not.toContain('API Docs')
    expect(next).not.toContain('/api/docs')
    expect(next).not.toContain('FileCode2')
    expect(next).toContain('<!-- Built-in Modules -->')
  })
})

describe('isCoreAppVueId', () => {
  it('matches the raw core App.vue SFC only', () => {
    expect(isCoreAppVueId('/core/src/components/App.vue')).toBe(true)
    expect(isCoreAppVueId('/core/src/components/App.vue?vue&type=template')).toBe(false)
    expect(isCoreAppVueId('/core/src/components/LandingPage.vue')).toBe(false)
  })
})

describe('patchAppHashNavigation', () => {
  it('restores the hash without a session and remounts on a same-hash sidebar click', () => {
    const coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'))
    const source = fs.readFileSync(path.join(coreDir, 'src/components/App.vue'), 'utf8')

    const next = patchAppHashNavigation(source)
    expect(next).toContain('await this.restoreFromHash()')
    expect(next).toContain("if ((window.location.hash || '#/') === nextHash)")
    expect(next).toContain('this.loadModuleView(manifest.slug, resolvedViewId)')
    expect(next).toContain('await this.loadInitialData()')
  })

  it('throws if core App.vue no longer matches the needles', () => {
    expect(() => patchAppHashNavigation('export default {}')).toThrow(/needle not found/)
  })

  it('still matches after the command-palette strip', () => {
    const coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'))
    const source = fs.readFileSync(path.join(coreDir, 'src/components/App.vue'), 'utf8')
    expect(() => patchAppHashNavigation(stripCommandPalette(source))).not.toThrow()
  })
})

describe('filterNavDiscoveryModule', () => {
  it('drops entries for excluded slugs', () => {
    expect(isNavDiscoveryId('\0virtual:nav-discovery')).toBe(true)
    const code = 'export default ' + JSON.stringify([
      { slug: 'ai-impact', viewId: 'dashboard' },
      { slug: 'product-upstreams', viewId: 'products' }
    ])
    expect(filterNavDiscoveryModule(code, ['product-upstreams'])).toBe(
      'export default ' + JSON.stringify([{ slug: 'product-upstreams', viewId: 'products' }])
    )
  })
})
