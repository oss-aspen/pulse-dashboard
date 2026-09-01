/**
 * Vite plugin: inject the static API shim and fix a few absolute public-asset paths.
 * Only registered when VITE_STATIC_HOST=true so the OpenShift production build is unchanged.
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
      next = next.replaceAll('href="/redhat-logo.svg"', 'href="./redhat-logo.svg"')
      return next
    },
    transform(code) {
      if (!code.includes('/redhat-logo.svg')) return null
      const next = code
        .replaceAll('"/redhat-logo.svg"', '`${import.meta.env.BASE_URL}redhat-logo.svg`')
        .replaceAll("'/redhat-logo.svg'", '`${import.meta.env.BASE_URL}redhat-logo.svg`')
      if (next === code) return null
      return { code: next, map: null }
    }
  }
}
