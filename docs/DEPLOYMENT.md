# OSAIPO Pulse deployment

This repository contains the OSAIPO-specific application image and OpenShift
overlay. Deployment is managed through Argo CD from the separate
`osaipo/pulse-gitops` repository.

## Runtime architecture

- Core platform: `@org-pulse/core` and the matching core container images.
- OSAIPO backend: `quay.io/osaipo-data/osaipo-pulse-backend`.
- OSAIPO frontend: `quay.io/osaipo-data/osaipo-pulse-frontend`.
- Current local module: `upstream-pulse`.
- Current platform extensions: allocation, Jira taxonomy, and About tabs.

## Production target

```text
Cluster:   prod-spoke-aws-us-east-1
Namespace: osaipo-aspen--pulse-dashboard
Argo app:  pulse-dashboard
Overlay:   deploy/openshift/overlays/osaipo-eng-prod
```

The Argo CD Application is defined in:

```text
osaipo/pulse-gitops/clusters/prod-spoke-aws-us-east-1/apps/pulse-dashboard.yaml
```

## CI/CD

A merge to `main` runs:

```bash
npm ci
npm run setup
npm run lint
npm test
npm run build
npm run validate:modules
npm run validate:openapi
npm run validate:dockerfile-deps
```

The image workflow then publishes immutable image tags to Quay and updates the
production overlay. Argo CD reconciles the updated overlay; do not manually
apply application manifests for routine deployment changes.

## OpenShift prerequisites

The tenant namespace is provisioned by `pulse-gitops`. Runtime secrets remain
outside Git:

| Secret | Required | Purpose |
|---|---:|---|
| `frontend-proxy-cookie` | Yes | OAuth proxy session cookie |
| `frontend-proxy-tls` | Generated | OpenShift service-serving certificate |
| `team-tracker-secrets` | Optional | Jira/GitHub/GitLab credentials |
| `osaipo-pulse-secrets` | Optional | OSAIPO integration credentials |
| `google-sa-key` | Optional | Google Sheets roster credential |

Create secrets through the approved enterprise secret-management process. Do
not commit secret values or copy them into manifests.

## Validation

```bash
npm run setup
npm run lint
npm test
npm run build
npm run validate:modules
npm run validate:openapi
npm run validate:dockerfile-deps
npx kustomize build deploy/openshift/overlays/osaipo-eng-prod
```

## Live verification

```bash
oc get application pulse-dashboard -n osaipo-aspen--argocd
oc get pods -n osaipo-aspen--pulse-dashboard
oc get routes -n osaipo-aspen--pulse-dashboard
oc get pvc -n osaipo-aspen--pulse-dashboard
```

Expected routes:

```text
pulse-dashboard.apps.int.spoke.prod.us-east-1.aws.paas.redhat.com
api-pulse-dashboard.apps.int.spoke.prod.us-east-1.aws.paas.redhat.com
```

Expected health checks:

```text
GET /healthz
GET /api/healthz
```
