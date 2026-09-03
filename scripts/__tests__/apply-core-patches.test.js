import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { parsePatchFile } = require('patch-package/dist/patch/parse')

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const applyScript = path.join(repoRoot, 'scripts/apply-core-patches.js')
const realPatch = path.join(repoRoot, 'patches/@org-pulse+core+2.0.69.patch')

const originals = {
  'index.html': `    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/redhat-logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Org Pulse</title>
  </head>
  <body>
`,
  'src/components/AboutView.vue': `    <template v-if="activeTab === 'about'">
      <!-- Hero -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Org Pulse</h2>
        <p class="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          A modular engineering dashboard that connects Jira, GitHub, and GitLab data with your team roster to surface delivery insights.
        </p>
`,
  'src/components/App.vue': `    const titlePrefix = ref('')

    watch(titlePrefix, (prefix) => {
      document.title = prefix ? \`\${prefix} Org Pulse\` : 'Org Pulse'
    })

    function handleBackendRecovery() {
`,
  'src/components/AppSidebar.vue': `        <img src="/redhat-logo.svg" alt="Red Hat" class="h-8 w-8 flex-shrink-0" />
        <transition name="fade">
          <div v-if="!collapsed" class="overflow-hidden whitespace-nowrap flex-1">
            <h1 class="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">Org Pulse</h1>
            <p v-if="titlePrefix" class="text-xs text-gray-400 dark:text-gray-500">{{ titlePrefix }}</p>
          </div>
        </transition>
`,
  'src/components/LandingPage.vue': `        <div v-if="allWidgets.length > 0" class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Org Pulse</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Select a module to get started</p>
          </div>
          <button
          </button>
        </div>
        <div v-else>
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Org Pulse</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">Select a module to get started</p>
        </div>
      </div>
`
}

function writeTree(root, prefix) {
  for (const [rel, contents] of Object.entries(originals)) {
    const abs = path.join(root, prefix, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, contents)
  }
  fs.mkdirSync(path.join(root, 'patches'), { recursive: true })
  fs.copyFileSync(realPatch, path.join(root, 'patches/@org-pulse+core+2.0.69.patch'))
}

function applyTo(tmp) {
  return spawnSync(process.execPath, [applyScript, tmp], { encoding: 'utf8' })
}

function expectBranded(base) {
  expect(fs.readFileSync(path.join(base, 'index.html'), 'utf8')).toContain('<title>Data Team Upstream Insights</title>')
  expect(fs.readFileSync(path.join(base, 'src/components/AboutView.vue'), 'utf8')).toContain('Data Team Upstream Insights')
  expect(fs.readFileSync(path.join(base, 'src/components/App.vue'), 'utf8')).toContain("prefix ? `${prefix} Data Team Upstream Insights` : 'Data Team Upstream Insights'")
  expect(fs.readFileSync(path.join(base, 'src/components/AppSidebar.vue'), 'utf8')).toContain('overflow-hidden flex-1 min-w-0')
  expect(fs.readFileSync(path.join(base, 'src/components/LandingPage.vue'), 'utf8')).not.toContain('>Org Pulse</h1>')
}

describe('apply-core-patches', () => {
  it('is parseable by patch-package', () => {
    const parsed = parsePatchFile(fs.readFileSync(realPatch, 'utf8'))
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed.every((part) => part.type === 'patch')).toBe(true)
  })

  it('applies the committed core branding patch onto the npm package layout', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'core-patches-'))
    writeTree(tmp, 'node_modules/@org-pulse/core')
    const result = applyTo(tmp)
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expectBranded(path.join(tmp, 'node_modules/@org-pulse/core'))
  })

  it('falls back to the core-repo layout used by the frontend-builder image', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'core-patches-src-'))
    writeTree(tmp, '.')
    const result = applyTo(tmp)
    expect(result.status, result.stderr || result.stdout).toBe(0)
    expectBranded(tmp)
  })
})
