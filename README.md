# OSAIPO Pulse

OSAIPO-specific modules and deployment for [Org Pulse](https://github.com/red-hat-data-services/org-pulse-core), an internal dashboard connecting employees and teams with upstream (i.e. GitHub) data to surface upstream insights.

This repo contains OSAIPO-specific modules, platform customizations, and deployment overlays. The core platform (`@org-pulse/core`) is installed as an npm dependency.

## Quick Start (Demo Mode)

Run the app with sample data — no credentials needed:

```bash
npm install
npm run setup          # Symlinks core platform files into the workspace

echo "DEMO_MODE=true" > .env
echo "VITE_DEMO_MODE=true" >> .env

npm run dev:full
```

Open http://localhost:5173.

## Quick Start (Docker — Live Data)

Run Pulse and the full Upstream Pulse stack with hot reload. You need Docker or Podman with Compose v2.20+ and a sibling `upstream-pulse` checkout at `../upstream-pulse` (or set `UPSTREAM_PULSE_DIR`).

```bash
cp .env.docker.example .env
# Edit .env: JIRA_EMAIL, JIRA_TOKEN, ADMIN_EMAILS, and GITHUB_TOKEN are required.
make dev-up
```

`GITHUB_TOKEN` must be a classic PAT with `read:user`, `repo`, and `read:org` for the full stack. Use `make dev-up-core` to run only Pulse without the sibling checkout, or `make dev-up-demo` for fixture data without credentials.

For an existing CollectOSS database, set `COLLECTOSS_DATABASE_URL` to a read-only PostgreSQL URL. `COLLECTOSS_SCHEMA` defaults to `data`; use `augur_data` for legacy Augur databases. With 8Knot, compose `AUGUR_USERNAME`, `AUGUR_PASSWORD`, `AUGUR_HOST`, `AUGUR_PORT`, and `AUGUR_DATABASE` into the URL, and map `AUGUR_SCHEMA=augur_data` to `COLLECTOSS_SCHEMA=augur_data` (`AUGUR_LOGIN_ENABLED` is 8Knot UI configuration only). For a database or tunnel on your host, use `host.docker.internal` in the URL with Docker or Podman >= 5.x; on Linux, bind tunnels to `0.0.0.0` (`oc port-forward --address 0.0.0.0` or `ssh -L 0.0.0.0:5411:…`) so containers can reach them. Run `make dev-check-collectoss` to verify reachability, credentials, and read-only schema access. Set `DEFAULT_DATA_SOURCE=collectoss` to make newly added projects use CollectOSS; `COLLECTOSS_FALLBACK_TO_GITHUB=true` keeps GitHub fallback enabled.

First data:

1. `make dev-up` enables Upstream Pulse and syncs the GitHub team automatically on the first run.
2. In the UI, open **Upstream Pulse → Portfolio → Add Project** (the Dashboard's + Add only appears once a project exists), paste a GitHub repo URL, and pick an existing org. Portfolio orgs are only groupings and show no data until repos are added.
3. Data persists across `make dev-down` and `make dev-up`; only `make dev-reset` wipes it. Team sync re-runs weekly.

### Troubleshooting

- **`column ... does not exist` or missing tables:** update the sibling checkout to current `main` by running `git switch main && git pull` inside `../upstream-pulse`, then run `make dev-up` again.
- **People & Teams shows "Failed to refresh" or empty views:** no roster has been synced yet. Connect to Red Hat VPN with IPA credentials, or configure a Google Sheet and service-account key, then use **Settings → Sync Now**.

## Quick Start (Full Setup)

For real Jira and GitHub data:

### Prerequisites

- Node.js 22+
- Red Hat VPN (required for LDAP roster sync)
- @redhat.com Google account

### 1. Install dependencies

```bash
npm install
npm run setup          # Symlinks core platform files into the workspace
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
JIRA_EMAIL=you@redhat.com
JIRA_TOKEN=your-jira-api-token        # From https://id.atlassian.com/manage-profile/security/api-tokens
ADMIN_EMAILS=you@redhat.com

# Optional — GitHub contribution stats
GITHUB_TOKEN=your-github-classic-pat   # Classic PAT with read:user scope

# Optional — automated roster sync from Google Sheets
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json
```

**Jira API Token:** Go to https://id.atlassian.com/manage-profile/security/api-tokens, click "Create API token", and paste the value as `JIRA_TOKEN`.

**GitHub Token:** Create a **classic** Personal Access Token (not fine-grained — GraphQL API doesn't support those yet) at https://github.com/settings/tokens with the `read:user` scope.

**Google Service Account** (for roster sync): See [Google Service Account Setup](#google-service-account-setup) below.

### 3. Start dev servers

```bash
npm run dev:full
```

This starts both the Vite frontend (port 5173) and the Express backend (port 3001). Vite proxies `/api` requests to the backend.

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001/api

### 4. Configure roster sync (first run)

On first launch, a yellow banner will appear directing you to **Settings**. There you can configure:

- **Org roots** — LDAP UIDs of org leaders whose teams you want to track (e.g., `shgriffi`)
- **Google Sheet ID** — The spreadsheet ID from the Google Sheets URL (the long alphanumeric string). Sheet names are auto-discovered.

Click "Sync Now" to populate the roster. The app will also sync automatically once every 24 hours.

## Google Service Account Setup

To use the Google Sheets roster sync:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Google Sheets API** (APIs & Services > Library)
4. Create a **Service Account** (APIs & Services > Credentials > Create Credentials)
5. Create a JSON key for the service account and download it
6. Place the key file at `secrets/google-sa-key.json` (this path is gitignored)
7. Set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json` in `.env`
8. Share your Google Sheet with the service account email (the `client_email` in the JSON key)

## Commands

```bash
npm run dev:full              # Start frontend + backend
npm run dev                   # Frontend only (Vite)
npm run dev:server            # Backend only (Express, needs .env)
npm test                      # Run all tests
npm run test:watch            # Tests in watch mode
npm run lint                  # ESLint
npm run build                 # Production build
npm run setup                   # Symlink core platform into workspace
npm run validate:modules      # Validate module manifests
npm run validate:openapi      # Validate OpenAPI annotations
npm run validate:dockerfile-deps  # Verify Dockerfile deps match package.json
npm run update:view-owners        # Regenerate platform/view-owners/owners.js from git history

# Docker/Podman local development (Compose v2.20+)
make dev-up                       # Start the full live-data stack
make dev-up-core                  # Start only Pulse frontend + backend
make dev-up-demo                  # Start Pulse with fixture data
make dev-down                     # Stop containers, preserving data and volumes
make dev-logs                     # Follow development logs
make dev-reset                    # Remove containers and named volumes, preserving ./data
make dev-enable-upstream          # Run the idempotent first-run bootstrap manually
make dev-check-collectoss         # Verify CollectOSS access with a read-only probe

# Container-based tests (requires Docker/Podman)
make smoke-test                 # Run smoke tests against OSAIPO images
make test-module MODULE=<name>  # Run integration tests for a module
```

## Tech Stack

- **Frontend**: Vue 3, Vite 8, Tailwind CSS 3, Chart.js 4
- **Backend**: Express (single server for local dev and production)
- **Auth**: OpenShift OAuth proxy (production), no auth (local dev)
- **Storage**: Local filesystem (`./data/`), PVC in OpenShift
- **Hosting**: OpenShift with ArgoCD
- **Testing**: Vitest (unit), Playwright (smoke & integration)

## Deployment

Deployed to OpenShift via ArgoCD. OSAIPO images extend core images from `@org-pulse/core`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full deployment guide.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, project structure, and code style guidelines.

Architecture and deployment details are in [`.claude/CLAUDE.md`](.claude/CLAUDE.md) — Claude Code reads this automatically.
