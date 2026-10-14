/**
 * Behavior test for the OWNED AppSidebar (app/src/components/AppSidebar.vue).
 *
 * The shadow copy hides reports, org-dashboard, and jira-taxonomy from the
 * People & Teams sidebar (the change originally shipped as the backend
 * manifest shadow in PR #30). The behavior tests pin what renders; the
 * source-delta test pins that the only difference from core's file is our
 * filter block — which also fails CI if core's AppSidebar changes upstream,
 * prompting a re-own (`npm run own-file -- src/components/AppSidebar.vue`).
 *
 * Note: core's pristine copy cannot be mounted here — by design, the shadow
 * plugin redirects ANY import that resolves to an owned core file, including
 * direct node_modules paths.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { mount } from '@vue/test-utils'
import AppSidebar from '../../app/src/components/AppSidebar.vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Mirrors the manifest the server serves for team-tracker: core navItems
// plus navItems pushed by module-views platform extensions (jira-taxonomy).
const teamTrackerManifest = {
  slug: 'team-tracker',
  name: 'People & Teams',
  icon: 'users-round',
  order: 0,
  client: {
    navItems: [
      { id: 'home', label: 'Team Directory', icon: 'Users', default: true },
      { id: 'people', label: 'People', icon: 'User' },
      { id: 'reports', label: 'Reports', icon: 'BarChart3' },
      { id: 'org-dashboard', label: 'Org Dashboard', icon: 'Building2' },
      { id: 'manager-dashboard', label: 'My Teams', icon: 'LayoutDashboard', requireRole: 'manager', requireCondition: 'in-app-mode' },
      { id: 'manage', label: 'Manage', icon: 'Settings', requireRole: 'team-admin', requireCondition: 'in-app-mode' },
      { id: 'jira-taxonomy', label: 'Jira Taxonomy', icon: 'Layers', order: 150 }
    ]
  }
}

function baseProps() {
  return {
    builtInManifests: [teamTrackerManifest],
    modules: [],
    activeModule: 'team-tracker',
    activeViewId: 'home',
    teamDataSource: 'in-app',
    isManager: true,
    isTeamAdmin: true
  }
}

function navLabels(wrapper) {
  return wrapper.findAll('button').map(b => b.text())
}

describe('owned AppSidebar — hidden nav items', () => {
  it('shows Team Directory, People, My Teams, and Manage', () => {
    const labels = navLabels(mount(AppSidebar, { props: baseProps() }))
    expect(labels).toContain('Team Directory')
    expect(labels).toContain('People')
    expect(labels).toContain('My Teams')
    expect(labels).toContain('Manage')
  })

  it('hides Reports, Org Dashboard, and Jira Taxonomy', () => {
    const labels = navLabels(mount(AppSidebar, { props: baseProps() }))
    expect(labels).not.toContain('Reports')
    expect(labels).not.toContain('Org Dashboard')
    expect(labels).not.toContain('Jira Taxonomy')
  })
})

// The exact additions that distinguish the owned copy from core's file.
const ADDED_DECLARATION = `// Nav items this deployment hides from the People & Teams sidebar.
// Applied before role/condition gating. The views themselves stay
// registered and reachable by URL — this trims navigation, it is not
// access control. Covers both core module navItems and navItems pushed
// by module-views platform extensions (e.g. jira-taxonomy).
const hiddenNavItems = new Set(['reports', 'org-dashboard', 'jira-taxonomy'])

`
const ADDED_FILTER = `          if (hiddenNavItems.has(item.id)) return false\n`

describe('owned AppSidebar — delta vs core', () => {
  it('differs from core only by the hiddenNavItems filter', () => {
    const owned = readFileSync(path.join(__dirname, '../../app/src/components/AppSidebar.vue'), 'utf8')
    const core = readFileSync(path.join(__dirname, '../../node_modules/@org-pulse/core/src/components/AppSidebar.vue'), 'utf8')

    const stripped = owned.replace(ADDED_DECLARATION, '').replace(ADDED_FILTER, '')
    expect(stripped).toBe(core)
  })
})
