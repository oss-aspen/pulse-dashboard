#!/bin/sh
# Dev container entrypoint.
#  - pulse-backend: syncs node_modules with package-lock.json, then (re)creates
#    relative @org-pulse/core symlinks so they work in the container AND on the host.
#  - pulse-frontend (SKIP_INSTALL=1): waits for the backend to finish the install.
set -eu

cd /app
CORE=node_modules/@org-pulse/core
HASH_FILE=node_modules/.lock-hash
want=$(sha256sum package-lock.json | cut -d' ' -f1)

if [ "${SKIP_INSTALL:-}" = "1" ]; then
  i=0
  while [ "$(cat "$HASH_FILE" 2>/dev/null || true)" != "$want" ] || [ ! -d "$CORE" ]; do
    i=$((i + 1))
    if [ "$i" -gt 120 ]; then
      echo "[dev-entrypoint] timed out waiting for pulse-backend to install dependencies" >&2
      exit 1
    fi
    sleep 1
  done
else
  have=$(cat "$HASH_FILE" 2>/dev/null || true)
  if [ "$have" != "$want" ] || [ ! -d "$CORE" ]; then
    echo "[dev-entrypoint] installing dependencies (npm ci)..."
    # node_modules is a volume mount point and cannot be removed itself; empty it instead.
    find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
    npm ci --ignore-scripts
    echo "$want" > "$HASH_FILE"
  fi

  # link <relative-target> <path>: replaces symlinks (incl. dangling host ones);
  # never touches a real directory.
  link() {
    if [ -e "$2" ] && [ ! -L "$2" ]; then
      echo "[dev-entrypoint] WARN: $2 is a real path, not linking" >&2
      return 0
    fi
    ln -sfn "$1" "$2"
  }

  mkdir -p modules shared
  link "$CORE/src" src
  for d in "$CORE"/modules/*/; do
    [ -d "$d" ] || continue
    m=$(basename "$d")
    link "../$CORE/modules/$m" "modules/$m"
  done
  for s in server client; do
    link "../$CORE/shared/$s" "shared/$s"
  done

  if [ -f "$CORE/index.html" ] \
     && { [ ! -f index.html ] || grep -q '<!-- @org-pulse/core -->' index.html; }; then
    cmp -s "$CORE/index.html" index.html 2>/dev/null || cp "$CORE/index.html" index.html
  fi
fi

# Bind-mount file events don't propagate on macOS + Podman: poll instead of node --watch.
if [ "${DEV_POLLING:-}" = "true" ] && [ "$*" = "node --watch server/index.js" ]; then
  set -- node deploy/dev-watch.js
fi

exec "$@"
