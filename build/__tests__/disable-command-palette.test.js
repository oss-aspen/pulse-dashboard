import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { isCoreAppVue, stripCommandPalette } from '../disable-command-palette.js'

const require = createRequire(import.meta.url)

describe('isCoreAppVue', () => {
  it('matches the raw core App.vue SFC only', () => {
    expect(isCoreAppVue('/core/src/components/App.vue')).toBe(true)
    expect(isCoreAppVue('/core/src/components/App.vue?vue&type=template')).toBe(false)
    expect(isCoreAppVue('/core/src/components/LandingPage.vue')).toBe(false)
  })
})

describe('stripCommandPalette', () => {
  it('removes the search hint, palette overlay, and / shortcut from current core App.vue', () => {
    const coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'))
    const source = fs.readFileSync(path.join(coreDir, 'src/components/App.vue'), 'utf8')

    expect(source).toContain('to explore')
    expect(source).toContain('<CommandPalette')
    expect(source).toContain("e.key === '/'")

    const next = stripCommandPalette(source)
    expect(next).not.toContain('to explore')
    expect(next).not.toContain('search-hint-breathe')
    expect(next).not.toContain('<CommandPalette')
    expect(next).not.toContain("e.key === '/'")
    expect(next).toContain('currentPageTitle')
    expect(next).toContain("e.key === 'b'")
  })
})
