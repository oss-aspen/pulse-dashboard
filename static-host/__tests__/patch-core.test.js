import { describe, it, expect } from 'vitest'
import {
  isBackendHealthModuleId,
  isCoreMainId,
  isModuleLoaderId,
  isNavDiscoveryId,
  staticModuleGlobPrefix,
  restrictModuleLoaderGlobs,
  filterNavDiscoveryModule
} from '../patch-core.js'

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
