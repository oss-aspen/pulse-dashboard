#!/usr/bin/env bash
# Sync the upstream deployment base into the OSAIPO-owned base.
# Usage: scripts/sync-osaipo-core-base.sh 2.0.69
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <core-version>" >&2
  exit 2
fi
VERSION="${VERSION#v}"
TAG="v${VERSION}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/deploy/openshift/osaipo-core-base"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ARCHIVE="$TMP_DIR/core.tar.gz"
EXTRACTED="$TMP_DIR/extracted"
mkdir -p "$EXTRACTED"

curl --fail --location --silent --show-error \
  "https://github.com/red-hat-data-services/org-pulse-core/archive/refs/tags/${TAG}.tar.gz" \
  --output "$ARCHIVE"
tar -xzf "$ARCHIVE" -C "$EXTRACTED"

SOURCE_BASE="$(find "$EXTRACTED" -type d -path '*/deploy/openshift/base' -print -quit)"
if [[ -z "$SOURCE_BASE" ]]; then
  echo "Unable to find deploy/openshift/base in ${TAG}" >&2
  exit 1
fi

rm -rf "$TARGET"
mkdir -p "$TARGET"
cp -R "$SOURCE_BASE"/. "$TARGET"/

# Keep the deployment base OSAIPO-owned. The core base includes an optional
# chatbot deployment, but Pulse Dashboard does not use it yet.
for file in "$TARGET/backend-deployment.yaml" "$TARGET/frontend-deployment.yaml" "$TARGET/kustomization.yaml"; do
  sed -i.bak \
    -e 's#quay.io/org-pulse/org-pulse-core-backend#quay.io/osaipo-data/org-pulse-core-backend#g' \
    -e 's#quay.io/org-pulse/org-pulse-core-frontend#quay.io/osaipo-data/org-pulse-core-frontend#g' \
    "$file"
  rm -f "$file.bak"
done

# Do not deploy the upstream chatbot until Pulse Dashboard owns and integrates
# a chatbot image and API contract. Remove these resources after every sync so
# a future core upgrade cannot silently reintroduce them.
rm -f "$TARGET/chatbot-deployment.yaml" "$TARGET/chatbot-service.yaml"
python3 - "$TARGET/kustomization.yaml" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()
text = re.sub(r"^[- ]+chatbot-(?:deployment|service)\.yaml\n", "", text, flags=re.MULTILINE)
text = text.replace("  - CHATBOT_SERVICE_URL=http://chatbot:8002\n", "")
text = re.sub(
    r"\n- literals:\n  - CHATBOT_PORT=8002\n  - ORG_PULSE_API_URL=http://backend:3001\n  name: chatbot-config\n",
    "\n",
    text,
)
text = re.sub(
    r"- name: quay\.io/org-pulse/org-pulse-chatbot\n  newTag: [^\n]+\n",
    "",
    text,
)
text = text.replace("\n\nimages:\n", "\nimages:\n")
path.write_text(text)
PY

# MPP storage admission requires an app-code label and an explicit
# reclaim-policy annotation on PVCs.
python3 - "$TARGET/backend-pvc.yaml" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
needle = "metadata:\n  name: team-tracker-data\n"
replacement = (
    needle
    + "  labels:\n    paas.redhat.com/appcode: OSPO-004\n"
    + "  annotations:\n    kubernetes.io/reclaimPolicy: Delete\n"
)
if needle not in text:
    raise SystemExit("unexpected backend-pvc.yaml format")
path.write_text(text.replace(needle, replacement, 1))
PY

printf '%s\n' "$TAG" > "$TARGET/CORE_VERSION"
cat > "$TARGET/UPSTREAM.md" <<EOF
# OSAIPO Core Deployment Base

- Upstream repository: https://github.com/red-hat-data-services/org-pulse-core
- Upstream release: ${TAG}
- Synced by: scripts/sync-osaipo-core-base.sh

## Local transformations

- Backend image references are rewritten to \`quay.io/osaipo-data/org-pulse-core-backend\`.
- Frontend image references are rewritten to \`quay.io/osaipo-data/org-pulse-core-frontend\`.
- The upstream chatbot resources are excluded because Pulse Dashboard does not use the chatbot yet.

The corresponding OSAIPO core image tags must be published before this base is deployed or the dashboard image workflow is run.
EOF

echo "Synchronized OSAIPO core base to ${TAG}"
