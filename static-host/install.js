/**
 * Patches window.fetch so /api calls resolve from bundled fixtures.
 * Imported from core src/main.js (and injected in index.html) before the app boots.
 */
import { isApiRequest, dispatchApi, toResponse } from './router.js'

const originalFetch = window.fetch.bind(window)

window.fetch = async function patchedFetch(input, init) {
  if (!isApiRequest(input)) {
    return originalFetch(input, init)
  }
  try {
    const result = await dispatchApi(input, init)
    return toResponse(result)
  } catch (err) {
    console.warn('[static-host] API shim error', err)
    return toResponse({ status: 200, body: {} })
  }
}
