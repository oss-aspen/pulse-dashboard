import fs from 'fs'
import path from 'path'

/**
 * Vite plugin: per-file shadowing of @org-pulse/core frontend sources.
 *
 * Files under the consumer's app/ directory mirror paths relative to the
 * core package root. When a module id resolves to a core file that has an
 * app/ counterpart, this plugin (enforce: 'pre', so it runs before Vite's
 * alias resolution) redirects the import to the app/ copy. Files without
 * an app/ counterpart resolve to core as usual.
 *
 * Shadowable surfaces:
 *   - core src/**      via '@/...' imports, relative imports, '/src/...' entries
 *   - core shared/**   via '@shared/...' imports
 *
 * Not shadowable per-file (by design):
 *   - modules/<slug>/** — discovered via import.meta.glob over directories.
 *     To own a module, replace its symlink in modules/ with a real directory;
 *     core's sync-core.js skips non-symlinks, so the takeover sticks.
 *   - platform/** — already consumer-owned.
 *
 * All paths are normalized through fs.realpathSync before comparison:
 * consumer dev setups reach core through a `src` symlink, and OSes like
 * macOS alias temp/user dirs (/var → /private/var), which would otherwise
 * break path-containment checks.
 *
 * Usage (see vite.config.mjs):
 *   plugins.push(shadowCorePlugin({ coreDir, appDir }))
 */
export function shadowCorePlugin({ coreDir, appDir }) {
  const EXT_PROBES = ['', '.vue', '.js', '.ts', '/index.js', '/index.vue']

  const realCoreDir = realpath(coreDir)
  const realAppDir = realpath(appDir)

  function stripQuery(id) {
    return String(id).split('?')[0]
  }

  function realpath(p) {
    try { return fs.realpathSync(p) } catch { return p }
  }

  function probeFile(base) {
    for (const ext of EXT_PROBES) {
      const p = base + ext
      try {
        if (fs.statSync(p).isFile()) return p
      } catch { /* not found — try next probe */ }
    }
    return null
  }

  function withinDir(dir, target) {
    const rel = path.relative(dir, target)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null
    return rel
  }

  /** Map a path relative to the core package root to its app/ shadow, if any. */
  function findOverride(relToCoreRoot) {
    if (!relToCoreRoot) return null
    return probeFile(path.join(realAppDir, relToCoreRoot))
  }

  return {
    name: 'org-pulse:shadow-core',
    enforce: 'pre',

    resolveId(source, importer) {
      source = stripQuery(source)
      if (!source) return null

      // HTML entry reference: '/src/main.js' (root-relative, no importer)
      if (source.startsWith('/src/')) {
        return findOverride(source.slice(1))
      }

      // Alias imports: '@/components/Foo.vue' → core src/components/Foo.vue
      if (source.startsWith('@/')) {
        return findOverride(withinDir(realCoreDir, path.join(realCoreDir, 'src', source.slice(2))))
      }

      // Alias imports: '@shared/client/Foo.vue' → core shared/client/Foo.vue
      if (source.startsWith('@shared/')) {
        return findOverride(withinDir(realCoreDir, path.join(realCoreDir, 'shared', source.slice('@shared/'.length))))
      }

      // Relative imports — only meaningful with an importer
      if (source.startsWith('.') && importer) {
        // Resolve against the importer's real directory so symlinked paths
        // (dev `src` symlink, OS dir aliases) normalize before containment
        // checks. Extension probing happens in probeFile.
        const realImporter = realpath(stripQuery(importer))
        const resolved = path.resolve(path.dirname(realImporter), source)

        // Case A: the importer is one of OUR override files. Siblings that
        // exist in app/ resolve normally (return null); missing siblings fall
        // back to the core counterpart so partial takeovers compose.
        const relToApp = withinDir(realAppDir, resolved)
        if (relToApp && probeFile(path.join(realAppDir, relToApp))) return null

        // Case B: the target is a core file — redirect if an app/ shadow exists.
        const relToCore = withinDir(realCoreDir, resolved) || relToApp
        if (relToCore) {
          const override = findOverride(relToCore)
          if (override) return override

          // Case A fallback: importer in app/, sibling not owned → core copy
          if (relToApp) {
            const coreCounterpart = probeFile(path.join(realCoreDir, relToApp))
            if (coreCounterpart) return coreCounterpart
          }
        }
      }

      return null
    }
  }
}
