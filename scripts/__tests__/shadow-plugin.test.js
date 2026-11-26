/**
 * Unit tests for the core-shadowing vite plugin (scripts/shadow-plugin.mjs).
 *
 * Builds a fixture tree that mimics the consumer layout:
 *
 *   <tmp>/core/src/components/App.vue          (core file, no override)
 *   <tmp>/core/src/components/AppSidebar.vue   (core file, HAS override)
 *   <tmp>/core/src/main.js                     (core entry, HAS override)
 *   <tmp>/core/shared/client/components/Card.vue (core file, HAS override)
 *   <tmp>/app/src/components/AppSidebar.vue    (override)
 *   <tmp>/app/src/main.js                      (override)
 *   <tmp>/app/shared/client/components/Card.vue (override)
 *
 * and asserts the redirect / fallback semantics for each import form.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { shadowCorePlugin } from '../shadow-plugin.mjs'

let tmp, coreDir, appDir, plugin

// The plugin normalizes every path through fs.realpathSync (symlinked dev
// layouts, macOS /var → /private/var), so expectations must use real paths.
const real = (p) => fs.realpathSync(p)

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-test-'))
  coreDir = path.join(tmp, 'core')
  appDir = path.join(tmp, 'app')

  const files = {
    'core/src/components/App.vue': '<template>core app</template>',
    'core/src/components/AppSidebar.vue': '<template>core sidebar</template>',
    'core/src/components/Owned.vue': '<template>core owned</template>',
    'core/src/main.js': 'export default "core main"',
    'core/shared/client/components/Card.vue': '<template>core card</template>',
    'app/src/components/AppSidebar.vue': '<template>MY sidebar</template>',
    'app/src/components/Owned.vue': '<template>MY owned</template>',
    'app/src/main.js': 'export default "MY main"',
    'app/shared/client/components/Card.vue': '<template>MY card</template>'
  }
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(tmp, rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, content)
  }

  plugin = shadowCorePlugin({ coreDir, appDir })
})

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('shadowCorePlugin.resolveId', () => {
  it('redirects @/ imports when an override exists', () => {
    const id = plugin.resolveId('@/components/AppSidebar.vue', path.join(coreDir, 'src', 'App.vue'))
    expect(id).toBe(real(path.join(appDir, 'src', 'components', 'AppSidebar.vue')))
  })

  it('falls through to core when no override exists', () => {
    const id = plugin.resolveId('@/components/App.vue', path.join(coreDir, 'src', 'main.js'))
    expect(id).toBeNull()
  })

  it('redirects relative imports from core files to overrides', () => {
    const importer = path.join(coreDir, 'src', 'components', 'App.vue')
    const id = plugin.resolveId('./AppSidebar.vue', importer)
    expect(id).toBe(real(path.join(appDir, 'src', 'components', 'AppSidebar.vue')))
  })

  it('resolves extension-less relative imports to overrides', () => {
    const importer = path.join(coreDir, 'src', 'components', 'App.vue')
    const id = plugin.resolveId('./AppSidebar', importer)
    expect(id).toBe(real(path.join(appDir, 'src', 'components', 'AppSidebar.vue')))
  })

  it('falls back to core for siblings not owned by an override importer', () => {
    // Owned AppSidebar.vue imports './App.vue' — App.vue is NOT owned
    const importer = path.join(appDir, 'src', 'components', 'AppSidebar.vue')
    const id = plugin.resolveId('./App.vue', importer)
    expect(id).toBe(real(path.join(coreDir, 'src', 'components', 'App.vue')))
  })

  it('lets override importers resolve their owned siblings normally', () => {
    // Owned AppSidebar.vue imports './Owned.vue' — Owned.vue IS owned
    const importer = path.join(appDir, 'src', 'components', 'AppSidebar.vue')
    const id = plugin.resolveId('./Owned.vue', importer)
    expect(id).toBeNull() // default resolution finds the app/ copy
  })

  it('redirects @shared/ imports when an override exists', () => {
    const id = plugin.resolveId('@shared/client/components/Card.vue', path.join(coreDir, 'src', 'components', 'App.vue'))
    expect(id).toBe(real(path.join(appDir, 'shared', 'client', 'components', 'Card.vue')))
  })

  it('redirects the /src/main.js HTML entry when an override exists', () => {
    const id = plugin.resolveId('/src/main.js', undefined)
    expect(id).toBe(real(path.join(appDir, 'src', 'main.js')))
  })

  it('ignores the HTML entry when no override exists', () => {
    fs.renameSync(path.join(appDir, 'src', 'main.js'), path.join(appDir, 'src', 'main.js.bak'))
    try {
      expect(plugin.resolveId('/src/main.js', undefined)).toBeNull()
    } finally {
      fs.renameSync(path.join(appDir, 'src', 'main.js.bak'), path.join(appDir, 'src', 'main.js'))
    }
  })

  it('strips query strings before resolving', () => {
    const id = plugin.resolveId('@/components/AppSidebar.vue?t=123456', path.join(coreDir, 'src', 'App.vue'))
    expect(id).toBe(real(path.join(appDir, 'src', 'components', 'AppSidebar.vue')))
  })

  it('ignores bare module imports (vue, npm packages)', () => {
    expect(plugin.resolveId('vue', path.join(coreDir, 'src', 'main.js'))).toBeNull()
    expect(plugin.resolveId('vue', undefined)).toBeNull()
  })

  it('ignores vite-internal ids', () => {
    expect(plugin.resolveId('/@vite/client', undefined)).toBeNull()
    expect(plugin.resolveId('\0virtual:nav-discovery', undefined)).toBeNull()
  })
})
