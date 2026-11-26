#!/bin/sh
set -eu

script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
project_root=$(CDPATH= cd "$script_dir/.." && pwd)
cd "$project_root"
. "$script_dir/dev-env.sh"

PULSE_HEALTH=http://localhost:3001/api/healthz
UPSTREAM_READY=http://localhost:4321/ready
compose=${COMPOSE:-docker compose}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

wait_for_url() {
  wait_url=$1
  wait_attempts=0
  while [ "$wait_attempts" -lt 60 ]; do
    if curl -fsS "$wait_url" >/dev/null 2>&1; then
      return 0
    fi
    wait_attempts=$((wait_attempts + 1))
    sleep 3
  done
  return 1
}

compose_profiles() {
  if [ "${COMPOSE_PROFILES+x}" = x ]; then
    printf '%s\n' "$COMPOSE_PROFILES"
  else
    envval COMPOSE_PROFILES
  fi
}

upstream_profile_enabled() {
  p=$(compose_profiles)
  case ",$p," in
    *,upstream,*) return 0 ;;
    *) return 1 ;;
  esac
}

preflight() {
  if [ "$(envval DEMO_MODE)" = "true" ]; then
    printf 'WARNING: .env sets DEMO_MODE=true; live Docker mode forces DEMO_MODE=false (use make dev-up-demo for fixtures).\n' >&2
  fi

  if ! upstream_profile_enabled; then
    return 0
  fi

  upstream_dir=${UPSTREAM_PULSE_DIR:-$(envval UPSTREAM_PULSE_DIR)}
  upstream_dir=${upstream_dir:-../upstream-pulse}
  if [ ! -d "$upstream_dir/backend" ]; then
    printf 'ERROR: Upstream Pulse backend not found at %s\n' "$upstream_dir/backend" >&2
    printf 'Set UPSTREAM_PULSE_DIR in .env or use make dev-up-core.\n' >&2
    exit 1
  fi

  github_token=${GITHUB_TOKEN:-$(envval GITHUB_TOKEN)}
  if [ -z "$github_token" ] || [ "$github_token" = "your-github-pat" ]; then
    printf 'ERROR: GITHUB_TOKEN is required for Upstream Pulse (use make dev-up-core to skip it).\n' >&2
    exit 1
  fi
}

bootstrap() {
  if ! wait_for_url "$PULSE_HEALTH"; then
    fail 'Pulse backend was not ready after 180s.'
  fi

  if ! upstream_profile_enabled; then
    printf 'Upstream profile is not enabled; skipping Upstream Pulse bootstrap.\n'
    return 0
  fi

  if ! modules=$(curl -fsS http://localhost:3001/api/admin/modules/state 2>/dev/null); then
    fail 'Could not read module state.'
  fi

  if printf '%s' "$modules" | tr -d '\n' | grep -q '"slug"[[:space:]]*:[[:space:]]*"upstream-pulse"[^}]*"enabled"[[:space:]]*:[[:space:]]*true'; then
    printf 'Upstream Pulse module already enabled; skipping enable.\n'
  else
    if ! curl -fsS -X POST http://localhost:3001/api/admin/modules/upstream-pulse/enable >/dev/null 2>&1; then
      fail 'Could not enable Upstream Pulse.'
    fi
    printf 'Enabled Upstream Pulse module; restarting Pulse backend.\n'
    if ! $compose restart pulse-backend; then
      fail 'Could not restart Pulse backend.'
    fi
    if ! wait_for_url "$PULSE_HEALTH"; then
      fail 'Pulse backend was not ready after 180s following restart.'
    fi
  fi

  if ! wait_for_url "$UPSTREAM_READY"; then
    fail 'Upstream Pulse backend was not ready after 180s.'
  fi

  if ! members=$(curl -fsS 'http://localhost:4321/api/team-members?limit=1' 2>/dev/null); then
    fail 'Could not read Upstream Pulse team members.'
  fi

  total=$(printf '%s' "$members" | sed -n 's/.*"total"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p')
  if [ -z "$total" ]; then
    fail 'Could not determine the Upstream Pulse team-member count.'
  fi

  if [ "$total" -gt 0 ]; then
    printf 'Team members already present; skipping initial GitHub team sync.\n'
  else
    team_org=${GITHUB_TEAM_ORG:-$(envval GITHUB_TEAM_ORG)}
    team_org=${team_org:-opendatahub-io}
    if ! curl -fsS -X POST http://localhost:4321/api/admin/team-sync >/dev/null 2>&1; then
      fail 'Could not queue the initial GitHub team sync.'
    fi
    printf 'Queued initial GitHub team sync for %s\n' "$team_org"
  fi

  printf 'Open http://localhost:5173 → Upstream Pulse → Portfolio → Add Project to track repos.\n'
}

case ${1:-bootstrap} in
  preflight)
    preflight
    ;;
  bootstrap)
    bootstrap
    ;;
  *)
    printf 'Usage: %s [preflight|bootstrap]\n' "$0" >&2
    exit 2
    ;;
esac
