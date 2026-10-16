#!/usr/bin/env bash
#
# Pulls the pinned Osaipo core images from Quay. If they are not published
# yet (e.g. the core version was just bumped and the image build hasn't
# finished), builds them from the pinned source tarball so container-based
# tests always run against the pinned core version.
#
# Usage: ./scripts/pull-or-build-core-images.sh
# Requires: docker (or podman via CONTAINER_RUNTIME), make, curl, tar, and
# node_modules installed (@org-pulse/core provides the pinned version).

set -euo pipefail

CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-docker}"

if make pull-core-images; then
  echo "Pinned core images pulled successfully."
  exit 0
fi

echo "Pinned Osaipo core images are not published yet; building them from the pinned source."
CORE_VERSION=$(tr -d '[:space:]' < deploy/openshift/osaipo-core-base/CORE_VERSION)
CORE_VERSION="${CORE_VERSION#v}"
CORE_TAG="v${CORE_VERSION}"
CORE_DIR=$(mktemp -d)
trap 'rm -rf "$CORE_DIR"' EXIT
curl --fail --location --silent --show-error \
  "https://github.com/red-hat-data-services/org-pulse-core/archive/refs/tags/${CORE_TAG}.tar.gz" \
  --output "$CORE_DIR/core.tar.gz"
tar -xzf "$CORE_DIR/core.tar.gz" -C "$CORE_DIR"
SOURCE_DIR=$(find "$CORE_DIR" -mindepth 1 -maxdepth 1 -type d -print -quit)
test -n "$SOURCE_DIR"
"$CONTAINER_RUNTIME" build \
  -f "$SOURCE_DIR/deploy/core.backend.Dockerfile" \
  -t "quay.io/osaipo-data/org-pulse-core-backend:${CORE_TAG}" \
  "$SOURCE_DIR"
"$CONTAINER_RUNTIME" build \
  -f "$SOURCE_DIR/deploy/core.frontend-builder.Dockerfile" \
  -t "quay.io/osaipo-data/org-pulse-core-frontend-builder:${CORE_TAG}" \
  "$SOURCE_DIR"
"$CONTAINER_RUNTIME" build \
  -f "$SOURCE_DIR/deploy/core.frontend-runtime.Dockerfile" \
  -t "quay.io/osaipo-data/org-pulse-core-frontend-runtime:${CORE_TAG}" \
  "$SOURCE_DIR"
