# OSAIPO People & Teams

OSAIPO modules and deployment for [Org Pulse](https://github.com/red-hat-data-services/org-pulse-core), an internal engineering dashboard connecting Jira, GitHub, and GitLab data with team rosters to surface delivery insights.

This repo contains AI Eng-specific modules, platform customizations, and deployment overlays. The core platform (`@org-pulse/core`) is installed as an npm dependency.

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
npm run build                    # Production build (OpenShift frontend image)
npm run build:static             # Static SPA with fixture-backed /api shim (GitLab Pages)
npm run preview:static           # Preview the static build locally (no Express)
npm run dev:static               # Vite only, with the static /api shim (no backend)
npm run setup                    # Symlink core platform into workspace
npm run validate:modules      # Validate module manifests
npm run validate:openapi      # Validate OpenAPI annotations
npm run validate:dockerfile-deps  # Verify Dockerfile deps match package.json
npm run update:view-owners        # Regenerate platform/view-owners/owners.js from git history

# Container-based tests (requires Docker/Podman)
make smoke-test                 # Run smoke tests against AI Eng images
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

Deployed to OpenShift via ArgoCD. AI Eng images extend core images from `@org-pulse/core`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full deployment guide.

### Static hosting (GitLab Pages)

The default `npm run build` still expects Express at `/api`. For a read-only Pages deploy, use the static build — it intercepts `/api` in the browser. No core fork: a Vite plugin injects `static-host/install.js` only when `VITE_STATIC_HOST=true`.

By default the static build **only bundles Product Upstreams** (`STATIC_ENABLED_SLUGS` in `static-host/static-nav.js`). Other `modules/` packages are omitted from Vite globs, so they do not appear in the sidebar and their client JS is not in the bundle. Home and About stay (they are shell pages). The home page **API Docs** card is removed (there is no Express `/api/docs`). `/api/whoami` returns 401 so core hides the user/login chip, Settings, and Refresh. Backend health polling is stubbed so the “Reconnecting…” modal does not appear. A fixed **Red Hat Confidential** footer is injected into `index.html` (internal use only; do not distribute outside of Red Hat).

```bash
npm run setup
npm run build:static
```

`dist/` is a hash-routed SPA (`#/module/view`). Relative asset URLs (`base: './'`) work on project Pages and custom domains.

Example GitLab CI job:

```yaml
pages:
  image: node:22
  script:
    - npm ci
    - npm run setup
    - npm run build:static
    - mv dist public
  artifacts:
    paths: [public]
```

This snapshot is read-only: no login, no writes, no live Jira/GitHub/GitLab. Add another static catalog module by implementing GET handlers and appending its slug to `STATIC_ENABLED_SLUGS` (that also includes it in the Vite glob). Re-run the Pages job when the catalog JSON changes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, project structure, and code style guidelines.

Architecture and deployment details are in [`.claude/CLAUDE.md`](.claude/CLAUDE.md) — Claude Code reads this automatically.
