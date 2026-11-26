# OSAIPO Pulse secrets

Secret values are never committed to Git. The production namespace is:

```text
osaipo-aspen--pulse-dashboard
```

Create and rotate secrets through the approved enterprise secret-management
process. The following names match the current core OpenShift base and OSAIPO
overlay.

## Required runtime secret

### `frontend-proxy-cookie`

| Key | Purpose |
|---|---|
| `session_secret` | OAuth proxy session encryption |

`frontend-proxy-tls` is generated automatically by the OpenShift service CA
from the annotation on the frontend Service.

## Optional integration secrets

### `team-tracker-secrets`

| Key | Purpose |
|---|---|
| `JIRA_EMAIL` | Jira account |
| `JIRA_TOKEN` | Jira API token |
| `GITHUB_TOKEN` | GitHub API fallback token |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key |
| `GITLAB_TOKEN` | GitLab API token |
| `PROXY_AUTH_SECRET` | Backend proxy authentication |

### `osaipo-pulse-secrets`

The OSAIPO overlay consumes optional integration keys including product-page,
GitLab documentation, SmartSheet, Google OAuth, and model-service credentials.
Only add keys for integrations that are enabled.

### Other optional secrets

| Secret | Key/path | Purpose |
|---|---|---|
| `ipa-credentials` | `IPA_BIND_DN`, `IPA_BIND_PASSWORD` | LDAP roster sync |
| `google-sa-key` | `google-sa-key.json` | Google Sheets roster sync |
| `aws-backup-credentials` | AWS credential keys | Optional backup integration |

## Local development

Use `.env` copied from `.env.example` for local development. `.env` and
credential files are ignored by Git. Demo mode does not require integration
credentials:

```bash
DEMO_MODE=true VITE_DEMO_MODE=true npm run dev:full
```

Never put real tokens in `.env.example`, source files, Kustomize manifests, or
pull requests.
