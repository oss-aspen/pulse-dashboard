import { describe, it, expect } from 'vitest'
import {
  MATOMO_SCRIPT_ID,
  buildMatomoMarkup,
  injectMatomoTracking
} from '../matomo-tracking.js'

const coreIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Org Pulse</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`

const MATOMO_URL = 'https://matomo.example.com'
const SITE_ID = '42'

describe('buildMatomoMarkup', () => {
  it('includes tracker URL with trailing slash', () => {
    const markup = buildMatomoMarkup(MATOMO_URL, SITE_ID)
    expect(markup).toContain('https://matomo.example.com/matomo.php')
    expect(markup).toContain('https://matomo.example.com/matomo.js')
  })

  it('normalises a URL that already has a trailing slash', () => {
    const markup = buildMatomoMarkup(`${MATOMO_URL}/`, SITE_ID)
    expect(markup).not.toContain('https://matomo.example.com//matomo.php')
    expect(markup).toContain('https://matomo.example.com/matomo.php')
  })

  it('includes the site ID', () => {
    const markup = buildMatomoMarkup(MATOMO_URL, SITE_ID)
    expect(markup).toContain(`'setSiteId', '${SITE_ID}'`)
  })

  it('disables cookies by default', () => {
    const markup = buildMatomoMarkup(MATOMO_URL, SITE_ID)
    expect(markup).toContain('disableCookies')
  })

  it('includes hashchange listener for SPA tracking', () => {
    const markup = buildMatomoMarkup(MATOMO_URL, SITE_ID)
    expect(markup).toContain('hashchange')
    expect(markup).toContain('setCustomUrl')
    expect(markup).toContain('trackPageView')
  })
})

describe('injectMatomoTracking', () => {
  it('inserts the tracking script before </head>', () => {
    const next = injectMatomoTracking(coreIndexHtml, { matomoUrl: MATOMO_URL, siteId: SITE_ID })
    expect(next).toContain(`id="${MATOMO_SCRIPT_ID}"`)
    expect(next.indexOf(MATOMO_SCRIPT_ID)).toBeLessThan(next.indexOf('</head>'))
  })

  it('is idempotent', () => {
    const once = injectMatomoTracking(coreIndexHtml, { matomoUrl: MATOMO_URL, siteId: SITE_ID })
    expect(injectMatomoTracking(once, { matomoUrl: MATOMO_URL, siteId: SITE_ID })).toBe(once)
  })

  it('returns html unchanged when matomoUrl is missing', () => {
    expect(injectMatomoTracking(coreIndexHtml, { siteId: SITE_ID })).toBe(coreIndexHtml)
  })

  it('returns html unchanged when siteId is missing', () => {
    expect(injectMatomoTracking(coreIndexHtml, { matomoUrl: MATOMO_URL })).toBe(coreIndexHtml)
  })

  it('returns html unchanged when no options are provided', () => {
    expect(injectMatomoTracking(coreIndexHtml)).toBe(coreIndexHtml)
  })

  it('throws when the HTML has no head close tag', () => {
    expect(() =>
      injectMatomoTracking('<html><body></body></html>', { matomoUrl: MATOMO_URL, siteId: SITE_ID })
    ).toThrow('</head>')
  })
})
