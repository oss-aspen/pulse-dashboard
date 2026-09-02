/**
 * Site-wide confidentiality marking for the static GitLab Pages build.
 * Injected into index.html so it does not depend on core App.vue.
 */

export const CONFIDENTIALITY_FOOTER_ID = 'confidentiality-footer'

export const CONFIDENTIALITY_FOOTER_MARKUP = `  <style>
    html { --confidentiality-footer-height: 2.5rem; }
    #${CONFIDENTIALITY_FOOTER_ID} {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      box-sizing: border-box;
      min-height: var(--confidentiality-footer-height);
      padding: 0.5rem 1rem;
      text-align: center;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.75rem;
      line-height: 1.25;
      color: #374151;
      background: #f9fafb;
      border-top: 2px solid #ee0000;
    }
    html.dark #${CONFIDENTIALITY_FOOTER_ID} {
      color: #d1d5db;
      background: #111827;
      border-top-color: #f87171;
    }
    #${CONFIDENTIALITY_FOOTER_ID} strong {
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    #app { padding-bottom: var(--confidentiality-footer-height); }
    aside.fixed.z-30 { height: calc(100vh - var(--confidentiality-footer-height)); }
  </style>
  <footer id="${CONFIDENTIALITY_FOOTER_ID}" role="contentinfo" data-testid="confidentiality-footer">
    <p><strong>Red Hat Internal</strong> — Internal Use Only. Future data may be added to this tool from internal data sources.<br>
    Distribution requests should be directed to the OSAIPO Data Team on slack: <a href="https://redhat.enterprise.slack.com/archives/C0BH2QNPQKZ" target="_blank" rel="noopener noreferrer">#proj-product-upstream-mapping</a>.</p>
  </footer>
`

export function injectConfidentialityFooter(html) {
  if (html.includes(`id="${CONFIDENTIALITY_FOOTER_ID}"`)) return html
  if (!html.includes('</body>')) {
    throw new Error('[static-host] </body> not found — cannot inject confidentiality footer')
  }
  return html.replace('</body>', `${CONFIDENTIALITY_FOOTER_MARKUP}\n</body>`)
}
