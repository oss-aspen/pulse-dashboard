/**
 * Vite plugin: inject the static API shim.
 * Only registered when VITE_STATIC_HOST=true so the OpenShift production build is unchanged.
 *
 * Do not rewrite "/redhat-logo.svg" in JS/Vue — Vite turns those into asset imports,
 * and a template-literal replacement produces invalid HTML and invalid import specifiers.
 */

export function staticHostPlugin() {
  return {
    name: 'org-pulse-static-host',
    transformIndexHtml(html) {
      let next = html
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
