/**
 * Vite plugin: inject the static API shim and disable backend-only chrome.
 * Only registered when VITE_STATIC_HOST=true so the OpenShift production build is unchanged.
 *
 * Do not rewrite "/redhat-logo.svg" in JS/Vue — Vite turns those into asset imports,
 * and a template-literal replacement produces invalid HTML and invalid import specifiers.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isBackendHealthModuleId, isCoreMainId, isModuleLoaderId, isNavDiscoveryId, isLandingPageId, restrictModuleLoaderGlobs, filterNavDiscoveryModule, stripLandingPageApiDocs } from './patch-core.js'

const pluginDir = path.dirname(fileURLToPath(import.meta.url))
const backendHealthStub = path.resolve(pluginDir, 'useBackendHealth-stub.js')
const installPath = path.resolve(pluginDir, 'install.js')
const stubSource = fs.readFileSync(backendHealthStub, 'utf8')

export function staticHostPlugin() {
  return {
    name: 'org-pulse-static-host',
    enforce: 'pre',
    resolveId(id) {
      if (isBackendHealthModuleId(id)) return backendHealthStub
    },
    transform(code, id) {
      if (isBackendHealthModuleId(id)) {
        return { code: stubSource, map: null }
      }
      if (isCoreMainId(id) && !code.includes('static-host/install')) {
        return {
          code: `import ${JSON.stringify(installPath)}\n${code}`,
          map: null
        }
      }
      if (isModuleLoaderId(id)) {
        try {
          return { code: restrictModuleLoaderGlobs(code), map: null }
        } catch (err) {
          this.warn(err.message)
        }
      }
      if (isNavDiscoveryId(id)) {
        return { code: filterNavDiscoveryModule(code), map: null }
      }
      if (isLandingPageId(id)) {
        try {
          return { code: stripLandingPageApiDocs(code), map: null }
        } catch (err) {
          this.warn(err.message)
        }
      }
    },
    transformIndexHtml(html) {
      let next = html
      // Backup if main.js prepend is skipped; module scripts still run in document order.
      if (!next.includes('static-host/install.js')) {
        next = next.replace(
          '<script type="module" src="/src/main.js"></script>',
          '<script type="module" src="/static-host/install.js"></script>\n    <script type="module" src="/src/main.js"></script>'
        )
      }
      // Vite HTML placeholder; stays valid quoted HTML (unlike a JS template literal).
      next = next.replaceAll('href="/redhat-logo.svg"', 'href="%BASE_URL%redhat-logo.svg"')
      return next
    }
  }
}
