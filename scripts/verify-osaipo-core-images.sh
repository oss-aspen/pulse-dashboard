#!/usr/bin/env bash
# Verify that all OSAIPO core images for a version are available in Quay.
# The caller must authenticate to quay.io before invoking this script.
# Usage: scripts/verify-osaipo-core-images.sh 2.0.69
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <core-version>" >&2
  exit 2
fi
VERSION="${VERSION#v}"
TAG="v${VERSION}"

images=(
  "quay.io/osaipo-data/org-pulse-core-backend:${TAG}"
  "quay.io/osaipo-data/org-pulse-core-frontend-builder:${TAG}"
  "quay.io/osaipo-data/org-pulse-core-frontend-runtime:${TAG}"
)

for image in "${images[@]}"; do
  echo "Checking ${image}"
  docker manifest inspect "$image" >/dev/null
done

echo "All OSAIPO core images are available for ${TAG}."
