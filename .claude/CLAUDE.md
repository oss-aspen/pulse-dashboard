# OSAIPO Pulse dashboard instructions

This repository is the OSAIPO consumer of `@org-pulse/core`.

## Current scope

The current repository contains:

- core team-tracker functionality supplied by `@org-pulse/core`;
- the `upstream-pulse` module;
- OSAIPO platform extensions under `platform/`;
- OpenShift overlays under `deploy/openshift/`.

Removed modules from older Org Pulse versions are not part of this repository.
Do not reintroduce their paths, routes, fixtures, workflows, or documentation
without an explicit product decision.

## Architecture

- Vue 3/Vite frontend; plain JavaScript only.
- Express backend supplied by core with OSAIPO modules copied into the image.
- `npm run setup` symlinks generated core files into `shared/`, `src/`, and
  `modules/team-tracker/`. Do not edit generated symlink targets in this repo.
- Platform extensions are not modules. Keep deployment-specific UI changes in
  `platform/`.
- Modules must use shared abstractions and must not import another module's
  private files.
- Secrets are declared through module context and must not be read directly from
  module code via `process.env`.

## Commands

```bash
npm ci
npm run setup
npm run lint
npm test
npm run build
npm run validate:modules
npm run validate:openapi
npm run validate:dockerfile-deps
npx kustomize build deploy/openshift/overlays/osaipo-eng-prod
```

## Deployment

The production deployment is managed by Argo CD through the separate
`osaipo/pulse-gitops` repository.

- Cluster: `prod-spoke-aws-us-east-1`
- Namespace: `osaipo-aspen--pulse-dashboard`
- Argo CD Application: `pulse-dashboard`
- Overlay: `deploy/openshift/overlays/osaipo-eng-prod`

Do not routinely apply application manifests directly with `oc` or `kubectl`.
Use GitHub Actions to test and publish images, then let Argo CD reconcile the
Git-tracked overlay.

Secrets stay outside Git. The OAuth cookie secret is required before the
frontend becomes ready; Jira, GitHub, GitLab, and Google credentials are
optional until their integrations are enabled.

## Testing policy

Changes to `modules/upstream-pulse`, `platform/`, or the integration tests must
include the relevant current integration suite:

```text
about-tabs
people-teams
sotu-dashboard
upstream-pulse
```

Do not reference removed releases, system-health, product-builds, customer-
insights, AI-impact, or PM-pipeline suites in new work.
