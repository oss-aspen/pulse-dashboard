#!/usr/bin/env node

/**
 * Apply patches/ diffs to @org-pulse/core.
 *
 * Locally, files live at node_modules/@org-pulse/core/.
 * In the core frontend-builder image they live at the image root (src/, index.html).
 */

const fs = require('fs')
const path = require('path')

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
const PATCHES_DIR = path.join(ROOT, 'patches')
const CORE_PREFIX = 'node_modules/@org-pulse/core/'

function resolvePatchedFile(gitPath) {
  const candidates = [
    path.join(ROOT, gitPath),
    path.join(ROOT, gitPath.replace(CORE_PREFIX, ''))
  ]
  return candidates.find((candidate) => fs.existsSync(candidate))
}

function applyHunk(content, hunkBody) {
  const oldLines = []
  const newLines = []
  for (const line of hunkBody.split('\n')) {
    if (line.startsWith('\\') || line === '') continue
    const marker = line[0]
    const text = line.slice(1)
    if (marker === '-') oldLines.push(text)
    else if (marker === '+') newLines.push(text)
    else if (marker === ' ') {
      oldLines.push(text)
      newLines.push(text)
    }
  }
  const oldBlock = oldLines.join('\n')
  const newBlock = newLines.join('\n')
  if (!content.includes(oldBlock)) {
    throw new Error(`hunk not found:\n${oldBlock}`)
  }
  return content.replace(oldBlock, newBlock)
}

function applyPatchFile(patchPath) {
  const diff = fs.readFileSync(patchPath, 'utf8')
  const files = diff.split(/^diff --git /m).slice(1)
  if (files.length === 0) {
    throw new Error(`${patchPath} contains no file diffs`)
  }
  for (const fileDiff of files) {
    const plusLine = fileDiff.split('\n').find((line) => line.startsWith('+++ '))
    if (!plusLine) continue
    const gitPath = plusLine.replace(/^\+\+\+ b\//, '').trim()
    const abs = resolvePatchedFile(gitPath)
    if (!abs) {
      throw new Error(`could not resolve patched file: ${gitPath}`)
    }
    let content = fs.readFileSync(abs, 'utf8')
    const hunks = fileDiff.split(/^@@ /m).slice(1)
    for (const hunk of hunks) {
      const body = hunk.slice(hunk.indexOf('\n') + 1)
      content = applyHunk(content, body)
    }
    fs.writeFileSync(abs, content)
    console.log(`[apply-core-patches] patched ${path.relative(ROOT, abs)}`)
  }
}

if (!fs.existsSync(PATCHES_DIR)) {
  console.log('[apply-core-patches] no patches/ directory — skipping')
  process.exit(0)
}

const patchFiles = fs.readdirSync(PATCHES_DIR).filter((name) => name.endsWith('.patch'))
if (patchFiles.length === 0) {
  console.log('[apply-core-patches] no .patch files — skipping')
  process.exit(0)
}

for (const name of patchFiles) {
  applyPatchFile(path.join(PATCHES_DIR, name))
}
