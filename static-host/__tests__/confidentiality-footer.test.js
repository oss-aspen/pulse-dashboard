import { describe, it, expect } from 'vitest'
import {
  CONFIDENTIALITY_FOOTER_ID,
  injectConfidentialityFooter
} from '../confidentiality-footer.js'

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

describe('injectConfidentialityFooter', () => {
  it('inserts a contentinfo footer before </body>', () => {
    const next = injectConfidentialityFooter(coreIndexHtml)
    expect(next).toContain(`id="${CONFIDENTIALITY_FOOTER_ID}"`)
    expect(next).toContain('data-testid="confidentiality-footer"')
    expect(next).toContain('role="contentinfo"')
    expect(next).toContain('Red Hat Confidential')
    expect(next).toContain('Internal Use Only')
    expect(next).toContain('Do not distribute outside of Red Hat')
    expect(next.indexOf(CONFIDENTIALITY_FOOTER_ID)).toBeLessThan(next.lastIndexOf('</body>'))
  })

  it('is idempotent', () => {
    const once = injectConfidentialityFooter(coreIndexHtml)
    expect(injectConfidentialityFooter(once)).toBe(once)
  })

  it('throws when the HTML has no body close tag', () => {
    expect(() => injectConfidentialityFooter('<html></html>')).toThrow('</body>')
  })
})
