/**
 * Static API handlers. Prefer fixture files and isomorphic module helpers;
 * never call the network. Writes are no-ops so the UI does not error.
 */

import { computeAllMetrics } from '../modules/ai-impact/server/metrics.js'
import { getConfig as getAiImpactConfig } from '../modules/ai-impact/server/config.js'
import { readFeatures, getLatestProjection as getFeatureProjection } from '../modules/ai-impact/server/features/storage.js'
import { computeFeatureMetrics } from '../modules/ai-impact/server/features/metrics.js'
import { readAssessments, getLatestProjection as getAssessmentProjection } from '../modules/ai-impact/server/assessments/storage.js'
import { readTestPlans, getLatestProjection as getTestPlanProjection } from '../modules/ai-impact/server/test-plans/storage.js'
import { readDecomposer } from '../modules/ai-impact/server/decomposer/storage.js'
import { readComponentOnboarding, getLatestProjection as getOnboardingProjection } from '../modules/ai-impact/server/component-onboarding/storage.js'
import { getListProjection } from '../modules/system-health/server/quality/storage.js'
import { getSummaryProjection } from '../modules/system-health/server/disconnected/storage.js'
import {
  getCatalog,
  getProduct,
  isValidProductId,
  searchPackages
} from '../modules/product-upstreams/server/catalog.js'
import draftDemo from '../modules/releases/server/draft-plans/fixtures/draft-3.6-demo.json'
import { readFromStorage, listStorageFiles } from './fixtures.js'
import { deriveRoster } from './roster.js'

export const STATIC_ENABLED_SLUGS = [
  'team-tracker',
  'product-upstreams',
  'ai-impact',
  'releases',
  'system-health',
  'customer-insights',
  'ai-catalyst',
  'okr-hub',
  'product-builds',
  'pm-pipeline'
]

const IDLE_REFRESH = { running: false, startedAt: null, lastResult: null }
const READ_ONLY = { status: 'skipped', message: 'Static site is read-only' }

function json(status, body) {
  return { status, body, contentType: 'application/json' }
}

function notFound(message) {
  return json(404, { error: message || 'Not found' })
}

function matchRoute(path, pattern) {
  const pSeg = pattern.split('/').filter(Boolean)
  const aSeg = path.split('/').filter(Boolean)
  if (pSeg.length !== aSeg.length) return null
  const params = {}
  for (let i = 0; i < pSeg.length; i++) {
    if (pSeg[i].startsWith(':')) {
      params[pSeg[i].slice(1)] = aSeg[i]
    } else if (pSeg[i] !== aSeg[i]) {
      return null
    }
  }
  return params
}

function storageRead(key) {
  return Promise.resolve(readFromStorage(key))
}

async function peopleMetrics() {
  const result = {}
  for (const file of listStorageFiles('people')) {
    const data = readFromStorage('people/' + file)
    if (data && data.jiraDisplayName) {
      result[data.jiraDisplayName] = {
        resolvedCount: data.resolved?.count ?? 0,
        resolvedPoints: data.resolved?.storyPoints ?? 0,
        inProgressCount: data.inProgress?.count ?? 0,
        avgCycleTimeDays: data.cycleTime?.avgDays ?? null,
        fetchedAt: data.fetchedAt
      }
    }
  }
  return result
}

function findPersonFile(name) {
  const needle = decodeURIComponent(name).toLowerCase()
  for (const file of listStorageFiles('people')) {
    const data = readFromStorage('people/' + file)
    if (!data) continue
    if (String(data.jiraDisplayName || '').toLowerCase() === needle) return data
    if (file.replace(/\.json$/, '').replace(/_/g, ' ') === needle) return data
  }
  return null
}

async function handlePlatform(path, query) {
  if (path === '/healthz') return json(200, { status: 'ok' })
  if (path === '/whoami') {
    return json(200, {
      email: 'public@example.com',
      displayName: 'Public viewer',
      isAdmin: false,
      isTeamAdmin: false,
      isManager: false,
      roles: [],
      authMethod: 'local-dev',
      apiBaseUrl: null
    })
  }
  if (path === '/site-config') {
    return json(200, readFromStorage('site-config.json') || { titlePrefix: 'Demo' })
  }
  if (path === '/last-refreshed') {
    const roster = deriveRoster()
    return json(200, { timestamp: roster.generatedAt || new Date().toISOString() })
  }
  if (path === '/roster' || path === '/modules/team-tracker/roster') {
    return json(200, deriveRoster())
  }
  if (path === '/messages') return json(200, [])
  if (path === '/search-index') return json(200, [])
  if (path === '/modules') return json(200, { modules: [] })
  if (path === '/built-in-modules/state') {
    return json(200, { enabledSlugs: STATIC_ENABLED_SLUGS.slice() })
  }
  if (path === '/built-in-modules/manifests') {
    return json(200, { modules: [] })
  }
  if (path === '/github/contributions') {
    return json(200, readFromStorage('github-contributions.json') || { users: {} })
  }
  if (path === '/gitlab/contributions') {
    return json(200, readFromStorage('gitlab-contributions.json') || { users: {} })
  }
  if (path === '/people/metrics' || path === '/modules/team-tracker/people/metrics') {
    return json(200, await peopleMetrics())
  }
  if (path === '/roles/me') return json(200, { roles: [] })
  if (path === '/roles') return json(200, readFromStorage('roles.json') || { version: 1, assignments: {} })
  if (path === '/roles/available') return json(200, { roles: [] })
  if (path === '/allowlist') return json(200, readFromStorage('allowlist.json') || [])
  if (path === '/tokens' || path === '/admin/tokens' || path === '/token-scopes') {
    return json(200, { tokens: [], scopes: [] })
  }
  if (path === '/health-metrics/tracking/status') return json(200, { optedOut: true })
  if (path === '/roster-sync/configured') return json(200, { configured: false })
  if (path === '/modules/team-tracker/permissions/me') {
    return json(200, { roles: [], isManager: false, uid: null, managedUids: [] })
  }
  if (path === '/modules/team-tracker/structure/teams') {
    const data = readFromStorage('team-data/teams.json') || { teams: {} }
    let teams = Object.values(data.teams || {})
    const orgKey = query.get('orgKey')
    if (orgKey) teams = teams.filter(t => t.orgKey === orgKey)
    return json(200, { teams })
  }
  if (path === '/modules/team-tracker/structure/field-definitions') {
    return json(200, readFromStorage('team-data/field-definitions.json') || { personFields: [], teamFields: [] })
  }
  if (path === '/modules/team-tracker/registry/people') {
    const registry = readFromStorage('team-data/registry.json')
    const people = registry && registry.people ? Object.values(registry.people) : []
    return json(200, { people })
  }
  if (path === '/modules/team-tracker/registry/stats') {
    const registry = readFromStorage('team-data/registry.json')
    const people = registry && registry.people ? Object.values(registry.people) : []
    return json(200, { total: people.length, active: people.filter(p => p.status === 'active').length })
  }
  if (path === '/modules/team-tracker/ipa/sync/status') {
    return json(200, { lastSync: null, running: false })
  }
  if (path === '/modules/team-tracker/registry/orgs') {
    const roster = deriveRoster()
    return json(200, { orgs: roster.orgs.map(o => ({ key: o.key, displayName: o.displayName })) })
  }
  if (path === '/modules/team-tracker/org-list') {
    const roster = deriveRoster()
    return json(200, roster.orgs.map(o => ({ key: o.key, displayName: o.displayName })))
  }

  let params = matchRoute(path, '/person/:name/metrics')
  if (params) {
    const data = findPersonFile(params.name)
    return data ? json(200, data) : notFound('Person not found')
  }
  params = matchRoute(path, '/modules/team-tracker/registry/people/:uid')
  if (params) {
    const registry = readFromStorage('team-data/registry.json')
    const person = registry && registry.people && registry.people[params.uid]
    return person ? json(200, person) : notFound('Person not found')
  }
  params = matchRoute(path, '/modules/team-tracker/field-options/:name')
  if (params) {
    const data = readFromStorage('team-data/field-options/' + params.name + '.json')
    return data ? json(200, data) : json(200, { values: [] })
  }
  params = matchRoute(path, '/team/:teamKey/metrics')
  if (params) return json(200, {})
  params = matchRoute(path, '/sprints/:sprintId/annotations')
  if (params) return json(200, {})

  return null
}

async function handleAiImpact(path, query) {
  const timeWindow = ['week', 'month', '3months'].includes(query.get('timeWindow'))
    ? query.get('timeWindow')
    : 'month'

  if (path === '/modules/ai-impact/rfe-data') {
    const data = readFromStorage('ai-impact/rfe-data.json')
    if (!data || !data.issues) {
      return json(200, {
        fetchedAt: null,
        jiraHost: 'https://redhat.atlassian.net',
        metrics: { createdPct: 0, createdChange: 0, trend: 'stable', revisedCount: 0, priorRevisedCount: 0, windowTotal: 0, totalRFEs: 0 },
        trendData: [],
        breakdown: [],
        pipelineFriction: {
          needsAttentionPct: 0, needsAttentionChange: 0, needsAttentionTrend: 'stable',
          feasibilityBlockedPct: 0, feasibilityBlockedChange: 0, feasibilityBlockedTrend: 'stable'
        },
        issues: []
      })
    }
    const config = await getAiImpactConfig(storageRead)
    const computed = computeAllMetrics(data.issues, timeWindow, config)
    return json(200, {
      fetchedAt: data.fetchedAt,
      jiraHost: 'https://redhat.atlassian.net',
      ...computed,
      issues: data.issues
    })
  }

  if (path === '/modules/ai-impact/features') {
    const data = await readFeatures(storageRead)
    const projection = getFeatureProjection(data)
    const featureList = Object.values(projection.features)
    const config = await getAiImpactConfig(storageRead)
    const metrics = computeFeatureMetrics(featureList, timeWindow, config)
    return json(200, { ...projection, ...metrics })
  }

  if (path === '/modules/ai-impact/assessments') {
    const data = await readAssessments(storageRead)
    return json(200, getAssessmentProjection(data))
  }

  if (path === '/modules/ai-impact/test-plans') {
    const data = await readTestPlans(storageRead)
    return json(200, getTestPlanProjection(data))
  }

  if (path === '/modules/ai-impact/decomposer') {
    const data = await readDecomposer(storageRead)
    return json(200, { ...data, jiraHost: 'https://redhat.atlassian.net' })
  }

  if (path === '/modules/ai-impact/component-onboarding') {
    const data = await readComponentOnboarding(storageRead)
    return json(200, getOnboardingProjection(data))
  }

  if (path === '/modules/ai-impact/autofix-data') {
    return json(200, readFromStorage('ai-impact/autofix-data.json') || { issues: [], fetchedAt: null })
  }
  if (path === '/modules/ai-impact/doc-data') {
    return json(200, readFromStorage('ai-impact/doc-data.json') || {})
  }
  if (path === '/modules/ai-impact/doc-mr-kpi-data') {
    return json(200, readFromStorage('ai-impact/doc-mr-kpi-data.json') || {})
  }
  if (path === '/modules/ai-impact/config') {
    return json(200, await getAiImpactConfig(storageRead))
  }
  if (path.endsWith('/status') || path.endsWith('/refresh/status') || path.endsWith('/sync/status')) {
    return json(200, IDLE_REFRESH)
  }

  let params = matchRoute(path, '/modules/ai-impact/features/:key')
  if (params) {
    const data = await readFeatures(storageRead)
    const entry = data.features && data.features[params.key]
    return entry ? json(200, entry) : notFound('Feature not found')
  }
  params = matchRoute(path, '/modules/ai-impact/assessments/:key')
  if (params) {
    const data = await readAssessments(storageRead)
    const entry = data.assessments && data.assessments[params.key]
    return entry ? json(200, entry) : notFound('Assessment not found')
  }
  params = matchRoute(path, '/modules/ai-impact/test-plans/:key')
  if (params) {
    const data = await readTestPlans(storageRead)
    const entry = data.testPlans && data.testPlans[params.key]
    return entry ? json(200, entry) : notFound('Test plan not found')
  }
  params = matchRoute(path, '/modules/ai-impact/component-onboarding/:key')
  if (params) {
    const data = await readComponentOnboarding(storageRead)
    const entry = data.components && data.components[params.key]
    return entry ? json(200, entry) : notFound('Component not found')
  }
  params = matchRoute(path, '/modules/ai-impact/pipeline-signals/:key')
  if (params) return json(200, { key: params.key, signals: [] })

  return null
}

async function handleReleases(path, query) {
  if (path === '/modules/releases/registry') {
    return json(200, readFromStorage('releases/registry.json') || { schemaVersion: 1, releases: [] })
  }
  if (path === '/modules/releases/execution/features') {
    const index = readFromStorage('releases/execution/index.json')
    if (!index || !index.features) {
      return json(200, { fetchedAt: null, featureCount: 0, features: [] })
    }
    let features = index.features
    const versionFilter = query.get('version')
    if (versionFilter) {
      const normalized = versionFilter.replace(/\.z\b/gi, '').toLowerCase()
      features = features.filter(f =>
        (f.fixVersions || []).some(v => String(v).replace(/\.z\b/gi, '').toLowerCase() === normalized)
      )
    }
    return json(200, { fetchedAt: index.fetchedAt, featureCount: features.length, features })
  }
  if (path === '/modules/releases/execution/versions') {
    const index = readFromStorage('releases/execution/index.json')
    const versions = new Set()
    for (const f of (index && index.features) || []) {
      for (const v of f.fixVersions || []) versions.add(v)
    }
    return json(200, { versions: [...versions] })
  }
  if (path === '/modules/releases/execution/status' || path === '/modules/releases/execution/config') {
    return json(200, path.endsWith('config') ? {} : IDLE_REFRESH)
  }
  if (path === '/modules/releases/execution/tracking/versions') {
    return json(200, { versions: ['3.5', '2.15', '2.14'] })
  }
  if (path === '/modules/releases/planning/releases') {
    const demoConfig = readFromStorage('releases/planning/config.json')
    if (demoConfig && demoConfig.releases) {
      const releases = Object.keys(demoConfig.releases).map(v => ({
        version: v,
        bigRockCount: (demoConfig.releases[v].bigRocks || []).length
      }))
      return json(200, releases)
    }
    return json(200, [])
  }
  if (path === '/modules/releases/pm-hub/pillar-config') {
    return json(200, readFromStorage('releases/pm-hub/pillar-config.json') || { pillars: [] })
  }
  if (path === '/modules/releases/tv-fv-delta') {
    return json(200, readFromStorage('releases/tv-fv-delta.json') || {})
  }
  if (path === '/modules/releases/tv-fv-delta/versions') {
    const data = readFromStorage('releases/tv-fv-delta.json')
    return json(200, { versions: (data && data.versions) || [] })
  }
  if (path === '/modules/releases/feature-pressure') {
    return json(200, readFromStorage('releases/feature-pressure.json') || {})
  }
  if (path === '/modules/releases/hygiene/config') {
    return json(200, readFromStorage('releases/hygiene/config.json') || {})
  }
  if (path === '/modules/releases/hygiene/program-report') {
    return json(200, readFromStorage('releases/hygiene/program-report.json') || {})
  }
  if (path === '/modules/releases/delivery/analysis') {
    return json(200, readFromStorage('releases/delivery/analysis.json') || {})
  }
  if (path === '/modules/releases/delivery/config') return json(200, {})
  if (path === '/modules/releases/draft-plans/access') {
    return json(200, {
      canViewDraftPlans: true,
      demoMode: true,
      session: { demoMode: true, canViewDraftPlans: true }
    })
  }
  if (path === '/modules/releases/draft-plans/cycles') {
    return json(200, {
      product: query.get('product') || 'RHOAI',
      products: ['RHOAI', 'RHAII'],
      defaultVersion: '3.6',
      cycles: [{ version: '3.6', editorAvailable: true }]
    })
  }
  if (path.includes('/refresh/status') || path.endsWith('/status')) {
    return json(200, IDLE_REFRESH)
  }

  let params = matchRoute(path, '/modules/releases/execution/features/:key')
  if (params) {
    const key = params.key.toUpperCase()
    const feature = readFromStorage('releases/execution/features/' + key + '.json')
    return feature ? json(200, feature) : notFound('Feature ' + key + ' not found')
  }
  params = matchRoute(path, '/modules/releases/registry/:id')
  if (params) {
    const registry = readFromStorage('releases/registry.json')
    const rel = ((registry && registry.releases) || []).find(r => r.id === params.id)
    return rel ? json(200, rel) : notFound('Release not found')
  }
  if (path === '/modules/releases/hygiene/features') {
    const version = query.get('version') || '3.5'
    const data = readFromStorage('releases/hygiene/features-' + version + '.json')
      || readFromStorage('releases/hygiene/features-3.5.json')
    return json(200, data || { features: [] })
  }
  params = matchRoute(path, '/modules/releases/delivery/tfa-risk/:version')
  if (params) {
    const data = readFromStorage('releases/delivery/tfa-risk-' + params.version + '.json')
      || readFromStorage('releases/delivery/tfa-risk-3.5.json')
    return json(200, data || {})
  }
  params = matchRoute(path, '/modules/releases/draft-plans/editor/:version')
  if (params) return json(200, draftDemo)
  params = matchRoute(path, '/modules/releases/draft-plans/:version')
  if (params) return json(200, draftDemo)
  params = matchRoute(path, '/modules/releases/planning/releases/:version/health')
  if (params) {
    return json(200, readFromStorage('releases/planning/health-cache-demo.json') || { features: [] })
  }
  params = matchRoute(path, '/modules/releases/planning/releases/:version/health/feature/:key')
  if (params) return json(200, { key: params.key, version: params.version })
  params = matchRoute(path, '/modules/releases/planning/releases/:version/candidates')
  if (params) {
    return json(200, readFromStorage('releases/planning/candidates-cache-demo.json') || { candidates: [] })
  }
  if (path === '/modules/releases/rhoai-component-architectures') {
    return json(200, readFromStorage('releases/rhoai-component-architectures/latest.json') || {})
  }
  if (path === '/modules/releases/cve-sustaining') {
    return json(200, readFromStorage('releases/cve-sustaining/latest.json') || {})
  }
  if (path === '/modules/releases/cve-sustaining/fix-availability') {
    return json(200, readFromStorage('releases/cve-sustaining/fix-availability.json') || {})
  }

  return null
}

async function handleOtherModules(path, query) {
  if (path === '/modules/product-upstreams/catalog') return json(200, getCatalog())
  if (path === '/modules/product-upstreams/search') {
    const q = query.get('q')
    if (!q || !String(q).trim()) return json(400, { error: 'Query parameter "q" is required' })
    return json(200, searchPackages(q))
  }
  let params = matchRoute(path, '/modules/product-upstreams/products/:id')
  if (params) {
    if (!isValidProductId(params.id)) return json(400, { error: 'Invalid product id' })
    const product = getProduct(params.id)
    if (!product) return notFound('Product not found')
    return json(200, { meta: getCatalog().meta, product })
  }

  if (path === '/modules/system-health/quality/reports') {
    const data = readFromStorage('system-health/quality/reports.json') || { lastSyncedAt: null, totalReports: 0, reports: {} }
    return json(200, getListProjection(data))
  }
  params = matchRoute(path, '/modules/system-health/quality/reports/:key')
  if (params) {
    const data = readFromStorage('system-health/quality/reports.json')
    const entry = data && data.reports && data.reports[params.key]
    return entry ? json(200, entry) : notFound('Report not found')
  }
  if (path === '/modules/system-health/odh-e2e-health') {
    return json(200, readFromStorage('system-health/odh-e2e-health.json') || {})
  }
  if (path === '/modules/system-health/odh-e2e-health/blocker-jiras') {
    return json(200, readFromStorage('system-health/odh-e2e-blocker-jiras.json') || { issues: [] })
  }
  if (path === '/modules/system-health/odh-e2e-health/runs') {
    return json(200, { runs: [] })
  }
  params = matchRoute(path, '/modules/system-health/odh-e2e-health/runs/:buildId/details')
  if (params) return json(200, { buildId: params.buildId, tests: [] })
  if (path === '/modules/system-health/disconnected/summary') {
    const data = readFromStorage('system-health/disconnected/reports.json') || { lastSyncedAt: null, repoCount: 0, repos: {} }
    return json(200, getSummaryProjection(data))
  }
  params = matchRoute(path, '/modules/system-health/disconnected/repos/:repoKey')
  if (params) {
    const data = readFromStorage('system-health/disconnected/reports.json')
    const repo = params.repoKey.replace('--', '/')
    const entry = data && data.repos && (data.repos[params.repoKey] || data.repos[repo])
    return entry ? json(200, entry) : notFound('Repo not found')
  }

  if (path === '/modules/customer-insights/interactions') {
    let data = readFromStorage('customer-insights/interactions.json') || []
    const component = query.get('component')
    if (component && component !== 'all') data = data.filter(item => item.component === component)
    return json(200, data)
  }
  if (path === '/modules/customer-insights/roadmap') {
    return json(200, readFromStorage('customer-insights/roadmap.json') || [])
  }
  if (path === '/modules/customer-insights/insights') {
    return json(200, readFromStorage('customer-insights/insights.json') || [])
  }
  if (path === '/modules/customer-insights/analytics') {
    return json(200, readFromStorage('customer-insights/analytics.json') || {})
  }
  if (path === '/modules/customer-insights/auth/google/status') {
    return json(200, { authenticated: false })
  }

  if (path === '/modules/ai-catalyst/boards') {
    const index = readFromStorage('ai-catalyst/index.json')
    return json(200, { boards: (index && index.boards) || [] })
  }
  params = matchRoute(path, '/modules/ai-catalyst/boards/:month')
  if (params) {
    const candidates = readFromStorage('ai-catalyst/boards/' + params.month + '.json')
    if (!candidates) return notFound('Board not found for ' + params.month)
    const list = Array.isArray(candidates) ? candidates : (candidates.candidates || [])
    return json(200, { month: params.month, total: list.length, filtered: list.length, candidates: list })
  }
  if (path === '/modules/ai-catalyst/showcase/entries') {
    const data = readFromStorage('ai-catalyst/showcase/showcase-data.json')
    return json(200, data || { entries: [] })
  }
  if (path === '/modules/ai-catalyst/config' || path === '/modules/ai-catalyst/stats') {
    return json(200, {})
  }

  if (path.startsWith('/modules/okr-hub/')) {
    const rest = path.slice('/modules/okr-hub/'.length)
    const file = readFromStorage('okr-hub/' + rest + '.json') || readFromStorage('okr-hub/' + rest)
    if (file) return json(200, file)
    if (rest === 'status' || rest === 'editable-status') return json(200, {})
    if (rest.startsWith('reports/')) return json(200, { rows: [], data: [] })
  }

  if (path.startsWith('/modules/product-builds/')) {
    if (path === '/modules/product-builds/config') return json(200, {})
    if (path === '/modules/product-builds/health') return json(200, { ok: true, static: true })
    if (path === '/modules/product-builds/package-reports') return json(200, [])
    return json(200, { items: [], results: [], drops: [], artifacts: [] })
  }

  if (path.startsWith('/modules/upstream-pulse/')) {
    return json(502, { error: 'Upstream Pulse requires a live API and is disabled on the static site' })
  }

  return null
}

function lookupFixtureFile(path) {
  const rest = path.replace(/^\/modules\//, '')
  const candidates = [
    rest + '.json',
    rest,
    rest.replace(/^\//, '') + '.json'
  ]
  for (const key of candidates) {
    const data = readFromStorage(key)
    if (data != null) return data
  }
  return undefined
}

export async function handleStaticApi(method, pathname, searchParams) {
  const path = pathname.replace(/^\/api/, '') || '/'
  const query = searchParams || new URLSearchParams()

  if (method !== 'GET' && method !== 'HEAD') {
    return json(200, READ_ONLY)
  }

  const platform = await handlePlatform(path, query)
  if (platform) return platform

  if (path.startsWith('/modules/ai-impact/')) {
    const hit = await handleAiImpact(path, query)
    if (hit) return hit
  }
  if (path.startsWith('/modules/releases/')) {
    const hit = await handleReleases(path, query)
    if (hit) return hit
  }
  const other = await handleOtherModules(path, query)
  if (other) return other

  const file = lookupFixtureFile(path)
  if (file !== undefined) return json(200, file)

  if (path.includes('refresh') || path.endsWith('/status')) return json(200, IDLE_REFRESH)
  return json(200, {})
}

export { json, matchRoute, READ_ONLY }
