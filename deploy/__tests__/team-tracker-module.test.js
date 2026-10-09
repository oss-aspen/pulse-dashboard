/**
 * Drift guard for the team-tracker manifest override.
 *
 * deploy/osaipo-eng.backend.Dockerfile shadows core's
 * /app/modules/team-tracker/module.json with deploy/team-tracker-module.json
 * to hide unused sidebar nav items. The override must stay a faithful copy
 * of the pinned core manifest (node_modules/@org-pulse/core) except for the
 * intentionally removed nav items — otherwise a core version bump could
 * silently drop routes, widgets, or settings from the deployed module.
 *
 * If this test fails after bumping CORE_VERSION, refresh the override from
 * the newly installed core manifest and re-apply the nav-item removals.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const REMOVED_NAV_ITEMS = ['reports', 'org-dashboard']

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

function coreManifestPath() {
  const corePkg = require.resolve('@org-pulse/core/package.json')
  return path.join(path.dirname(corePkg), 'modules', 'team-tracker', 'module.json')
}

describe('team-tracker manifest override', () => {
  it('removes exactly the intended nav items', () => {
    const core = readJson(coreManifestPath())
    const override = readJson(path.join(__dirname, '..', 'team-tracker-module.json'))

    const coreIds = core.client.navItems.map(n => n.id)
    const overrideIds = override.client.navItems.map(n => n.id)

    expect(coreIds.filter(id => !REMOVED_NAV_ITEMS.includes(id))).toEqual(overrideIds)
    expect(overrideIds).not.toContain('reports')
    expect(overrideIds).not.toContain('org-dashboard')
  })

  it('is otherwise identical to the pinned core manifest', () => {
    const core = readJson(coreManifestPath())
    const override = readJson(path.join(__dirname, '..', 'team-tracker-module.json'))

    const stripNavItems = (m) => {
      const copy = JSON.parse(JSON.stringify(m))
      copy.client.navItems = null
      return copy
    }

    // Deep-equal on everything except client.navItems — catches drift when
    // the pinned core version changes any other part of the manifest.
    expect(stripNavItems(override)).toEqual(stripNavItems(core))
  })
})

describe('jira-taxonomy platform extension', () => {
  it('has no sidebar nav item but keeps the view and server entry mounted', () => {
    const manifest = readJson(path.join(__dirname, '..', '..', 'platform', 'jira-taxonomy', 'manifest.json'))

    // navItems removed → no "Jira Taxonomy" entry in the People & Teams sidebar
    expect(manifest.navItems).toBeUndefined()

    // client.views kept → the view stays registered (reachable by URL)
    expect(manifest.client?.views?.['jira-taxonomy']).toBe('./client/JiraTaxonomyView.vue')

    // server entry kept → /api/modules/team-tracker jira routes stay live
    expect(manifest.server?.entry).toBe('./server/index.js')
  })
})
