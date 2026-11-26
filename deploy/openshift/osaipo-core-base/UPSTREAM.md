# OSAIPO Core Deployment Base

- Upstream repository: https://github.com/red-hat-data-services/org-pulse-core
- Upstream release: v2.0.69
- Synced by: scripts/sync-osaipo-core-base.sh

## Local transformations

- Backend image references are rewritten to `quay.io/osaipo-data/org-pulse-core-backend`.
- Frontend image references are rewritten to `quay.io/osaipo-data/org-pulse-core-frontend`.
- The upstream chatbot resources are excluded because Pulse Dashboard does not use the chatbot yet.

The corresponding OSAIPO core image tags must be published before this base is deployed or the dashboard image workflow is run.
