/**
 * Patches window.fetch so /api calls resolve from bundled fixtures.
 * Loaded as a Vite HTML module entry before src/main.js.
 */
import { isApiRequest, dispatchApi, toResponse } from './router.js'

const originalFetch = window.fetch.bind(window)

window.fetch = async function patchedFetch(input, init) {
  if (!isApiRequest(input)) {
    return originalFetch(input, init)
  }
  const result = await dispatchApi(input, init)
  return toResponse(result)
}
