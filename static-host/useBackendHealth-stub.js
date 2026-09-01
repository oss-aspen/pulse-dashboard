/**
 * No-op backend health for the static host.
 * Core's BackendConnectivityModal polls /api/healthz and shows "Reconnecting…"
 * when that fails. On GitLab Pages there is no Express, so disable the check.
 */
import { ref } from 'vue'

const isBackendDown = ref(false)
const isExtendedOutage = ref(false)

export function useBackendHealth() {
  return { isBackendDown, isExtendedOutage }
}

export function onRecovery(_cb) {}
export function offRecovery(_cb) {}

export const CHECK_INTERVAL = 5000
export const FAILURE_THRESHOLD = 2
export const EXTENDED_OUTAGE_MS = 2 * 60 * 1000
export function checkHealth() {}
export function handleFailure() {}
export function _resetForTesting() {}
