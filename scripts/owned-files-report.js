#!/usr/bin/env node
/**
 * Ownership + drift report for app/ shadow files.
 *
 * For every file recorded in app/owned.json, compares three versions:
 *   - base:  the core file as it was when you took ownership (hash snapshot)
 *   - yours: the current app/ copy
 *   - core:  the core file in the currently installed package
 *
 * States:
 *   unmodified         yours == base, core == base  (owned but not yet edited)
 *   modified-by-you    yours != base, core == base  (your changes, no conflict)
 *   upstream-changed   yours == base, core != base  (core moved; safe to re-own)
 *   diverged           yours != base, core != base  (manual merge needed)
 *   missing-locally    app/ copy deleted — ownership entry is stale
 *   removed-upstream   core no longer ships the file
 *
 * Exit code 1 when any file is DIVERGED, so this can gate CI after a
 * CORE_VERSION bump.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'))
const appDir = path.join(__dirname, '..', 'app')
const ownedPath = path.join(appDir, 'owned.json')

function hashFile(p) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16)
  } catch {
    return null
  }
}

const corePkg = JSON.parse(fs.readFileSync(path.join(coreDir, 'package.json'), 'utf8'))
const owned = fs.existsSync(ownedPath)
  ? JSON.parse(fs.readFileSync(ownedPath, 'utf8'))
  : {}

const entries = Object.entries(owned)
if (entries.length === 0) {
  console.log('app/ — no files owned. Take one over with:')
  console.log('  npm run own-file -- src/components/AppSidebar.vue')
  process.exit(0)
}

console.log(`app/ ownership report (installed core: v${corePkg.version})\n`)

let diverged = 0
for (const [rel, meta] of entries.sort(([a], [b]) => a.localeCompare(b))) {
  const yours = hashFile(path.join(appDir, rel))
  const core = hashFile(path.join(coreDir, rel))
  const base = meta.baseHash

  let state
  if (yours === null) state = 'missing-locally'
  else if (core === null) state = 'removed-upstream'
  else if (yours === base && core === base) state = 'unmodified'
  else if (yours !== base && core === base) state = 'modified-by-you'
  else if (yours === base && core !== base) state = 'upstream-changed'
  else { state = 'diverged'; diverged++ }

  const note = {
    'unmodified': 'owned, not yet edited',
    'modified-by-you': 'your changes, no conflict',
    'upstream-changed': `core moved since v${meta.baseCoreVersion} — your copy is unmodified, safe to re-own`,
    'diverged': `you edited it AND core changed it since v${meta.baseCoreVersion} — manual merge needed`,
    'missing-locally': 'app/ copy deleted — remove the stale entry from app/owned.json',
    'removed-upstream': 'core no longer ships this file'
  }[state]

  console.log(`  ${state.padEnd(18)} ${rel}`)
  console.log(`  ${' '.repeat(18)} → ${note}`)
}

console.log(`\n${entries.length} file(s) owned, ${diverged} diverged`)
process.exit(diverged > 0 ? 1 : 0)
