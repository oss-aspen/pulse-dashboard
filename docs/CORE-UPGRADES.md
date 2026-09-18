# OSAIPO Core Upgrades

The dashboard keeps an OSAIPO-owned copy of the core OpenShift deployment base at
`deploy/openshift/osaipo-core-base`. The source release is recorded in
`CORE_VERSION` and `UPSTREAM.md`.

## Required image contract

The matching version is published in Quay as three OSAIPO-owned build inputs:

- `quay.io/osaipo-data/org-pulse-core-backend:vX.Y.Z`
- `quay.io/osaipo-data/org-pulse-core-frontend-builder:vX.Y.Z`
- `quay.io/osaipo-data/org-pulse-core-frontend-runtime:vX.Y.Z`

The OSAIPO dashboard workflow consumes these images and publishes the resulting
backend and frontend images to the same `osaipo-data` organization. The plain
`org-pulse-core-frontend` deployment image is not published because the OSAIPO
overlay replaces it with the assembled `osaipo-pulse-frontend` image.

## Controlled update flow

1. Run `scripts/sync-osaipo-core-base.sh X.Y.Z` when testing locally, or let the
   scheduled `Core Upgrade` workflow run.
2. The upgrade workflow updates `@org-pulse/core`, refreshes the vendored
   deployment base, and renders the production Kustomize overlay.
3. The workflow opens a pull request. Review the generated base changes and CI
   before merging.
4. After merge, `Build & Push Osaipo Core Images` publishes the three pinned core
   inputs. `Build & Push Images` waits for those tags, builds the dashboard
   images, runs smoke tests, and commits their immutable tags to the production
   overlay.
5. If either workflow needs manual recovery, run the core-image workflow first,
   then dispatch the dashboard image workflow after all three core tags exist.

The sync script removes the upstream chatbot resources because Pulse Dashboard
does not use the chatbot yet. A future chatbot integration should be added as an
explicit, separately owned deployment when its image, API contract, and secrets
are defined.
