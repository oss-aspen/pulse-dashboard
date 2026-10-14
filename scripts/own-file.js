#!/usr/bin/env node
/**
 * Take ownership of a core frontend file.
 *
 * Copies the file from the installed @org-pulse/core package into app/
 * (the shadow root wired up by scripts/shadow-plugin.mjs) and records its
 * base hash + core version in app/owned.json for drift reporting.
 *
 * Usage:
 *   npm run own-file -- src/components/AppSidebar.vue
 *   npm run own-file -- shared/client/components/Card.vue
 *
 * The path is relative to the core package root. After takeover, edit the
 * app/ copy freely — the build picks it up automatically (dev + image).
 *
 * To give a file back to core: delete the app/ copy and its entry in
 * app/owned.json.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'))
const appDir = path.join(__dirname, '..', 'app')
const ownedPath = path.join(appDir, 'owned.json')

const rel = process.argv[2]
if (!rel) {
  console.error('Usage: npm run own-file -- <path relative to core package root>')
  console.error("  e.g. npm run own-file -- src/components/AppSidebar.vue")
  process.exit(1)
}

const normalized = rel.replace(/^\.\//, '')
const src = path.join(coreDir, normalized)
if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
  console.error(`Not found in core package: ${src}`)
  process.exit(1)
}

const dest = path.join(appDir, normalized)
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.copyFileSync(src, dest)

const corePkg = JSON.parse(fs.readFileSync(path.join(coreDir, 'package.json'), 'utf8'))
const owned = fs.existsSync(ownedPath)
  ? JSON.parse(fs.readFileSync(ownedPath, 'utf8'))
  : {}

owned[normalized] = {
  baseHash: crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex').slice(0, 16),
  baseCoreVersion: corePkg.version,
  takenAt: new Date().toISOString()
}
fs.writeFileSync(ownedPath, JSON.stringify(owned, null, 2) + '\n')

console.log(`You now own ${normalized}`)
console.log(`  shadow copy: app/${normalized}`)
console.log(`  base: core v${corePkg.version} @ ${owned[normalized].baseHash}`)
