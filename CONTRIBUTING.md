# Contributing to People & Teams

## Prerequisites

- **Node.js 22+** and npm
- **Red Hat VPN** connection (for LDAP roster sync)
- A **Jira Cloud API token** for live data — [create one here](https://id.atlassian.com/manage-profile/security/api-tokens) or just use **Demo Mode** (no credentials needed)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/red-hat-data-services/rhai-org-pulse.git
cd rhai-org-pulse
npm install
npm run setup    # Symlinks core platform files (src/, shared/, modules/team-tracker) into workspace
```

### 2. Configure environment

```bash
cp .env.example .env
```

**Option A — Demo Mode (no credentials needed):**
```env
DEMO_MODE=true
VITE_DEMO_MODE=true
```

**Option B — Live data:**
```env
JIRA_EMAIL=you@redhat.com
JIRA_TOKEN=your-jira-api-token
ADMIN_EMAILS=you@redhat.com

# Optional
GITHUB_TOKEN=your-github-classic-pat
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json
```

See [README.md](README.md) for details on obtaining each credential.

### 3. Run locally

```bash
npm run dev:full
```

This starts both the Vite frontend (port 5173) and the Express dev server (port 3001) concurrently. The Vite dev server proxies `/api` requests to the backend.

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001/api

### 4. Containerized alternative (Docker/Podman)

Use Compose v2.20+ and clone `upstream-pulse` at `../upstream-pulse`, or set `UPSTREAM_PULSE_DIR` to its location. Then:

```bash
cp .env.docker.example .env  # Fill in live credentials, including GITHUB_TOKEN
make dev-up
```

Use `make dev-up-core` without the Upstream Pulse checkout, or `make dev-up-demo` for fixture mode. The same Compose files support Docker and Podman; on Apple Silicon, images build and run natively as `arm64` without `--platform linux/amd64`.

On the first run, `make dev-up` enables Upstream Pulse and queues GitHub team sync when no team members exist. Use **Upstream Pulse → Portfolio → Add Project** (the Dashboard's + Add only appears once a project exists) in the UI to paste a GitHub repo URL and pick an existing org; Portfolio orgs only group repos and show no data until repos are added. Data persists across `dev-down`/`dev-up` and is wiped only by `dev-reset`; team sync also runs weekly.

Container development details:

- The repository is bind-mounted at `/app`; `pulse_node_modules` keeps Linux-native dependencies separate from host packages. Only `pulse-backend` runs `npm ci`; `pulse-frontend` sets `SKIP_INSTALL=1` and waits up to 120 seconds for the lockfile hash.
- Core links (`src`, core modules, and `shared/{server,client}`) are rewritten as relative symlinks. Existing real directories are left untouched with a warning.
- The backend restarts on code changes but not on writes under `data/`. `DEV_POLLING=true` (the `.env.docker.example` default) switches the backend to a polling watcher (`deploy/dev-watch.js`) and Vite to polling; it is required on macOS with Podman, where bind-mount file events don't propagate. Set `DEV_POLLING=false` on Linux or Docker Desktop if file events work.
- Containers run as `node` (UID 1000). On hosts with a different UID, add a local Compose `user: "<uid>:0"` override for both Pulse services.
- Red Hat VPN is required for IPA LDAP and internal GitLab. If VPN DNS stops working after connecting, restart the Podman machine or Docker Desktop.

For CollectOSS, configure `COLLECTOSS_DATABASE_URL` with a read-only PostgreSQL URL and run `make dev-check-collectoss`. `COLLECTOSS_SCHEMA` defaults to `data` (`augur_data` for legacy Augur databases). Use `host.docker.internal` in the URL for a host database or tunnel (Docker or Podman >= 5.x); Linux tunnels must bind `0.0.0.0` (`oc port-forward --address 0.0.0.0` or `ssh -L 0.0.0.0:5411:…`). See README for the 8Knot `AUGUR_*` mapping. Set `DEFAULT_DATA_SOURCE=collectoss` to make newly added projects use CollectOSS, and use `COLLECTOSS_FALLBACK_TO_GITHUB=false` to disable GitHub fallback.

To self-host CollectOSS, run `docker compose up` inside `../collectoss-dev` as a separate stack or restore its sample database dump from docs.collectoss.org, then point `COLLECTOSS_DATABASE_URL` at it. A fresh CollectOSS database starts empty and needs harvesting before it contains useful data.

`make dev-down` preserves all data and volumes. `make dev-reset` also removes the named dependency, Postgres, and Redis volumes but preserves `./data`.

### 5. Run tests

```bash
npm test            # single run
npm run test:watch  # watch mode
npm run lint        # linting
```

## Project Structure

This repo is the AI Engineering consumer of [`@org-pulse/core`](https://github.com/red-hat-data-services/org-pulse-core). Core platform files (`src/`, `shared/`, `modules/team-tracker`) are symlinked into the workspace by `npm run setup`.

```
server/
  index.js            # Thin wrapper — calls core's startServer() with AI Eng config

modules/              # AI Eng-specific feature modules (auto-discovered via module.json)
  ai-impact/          # AI Impact assessments
  releases/           # Release tracking & execution pipeline
  system-health/      # System health monitoring
  upstream-pulse/     # Upstream community tracking
  ai-catalyst/        # AI Catalyst
  customer-insights/  # Customer insights (Google Sheets)
  okr-hub/            # OKR tracking & commitment reports
  product-builds/     # Product build tracking

platform/             # AI Eng-specific core UI customizations (About page tabs, etc.)

deploy/
  osaipo-eng.backend.Dockerfile     # AI Eng backend (extends core backend image)
  osaipo-eng.frontend.Dockerfile    # AI Eng frontend (extends core builder + runtime)
  openshift/
    overlays/osaipo-eng/        # AI Engineering shared overlay (kustomize remote base from core)
    overlays/osaipo-eng-dev/    # AI Eng dev cluster overlay
    overlays/osaipo-eng-preprod/ # AI Eng preprod overlay
    overlays/osaipo-eng-prod/   # AI Eng prod overlay

scripts/
  setup.js                  # Symlinks core files into workspace
  validate-dockerfile-deps.js  # Verifies Dockerfile deps match package.json
  openapi-route-count.json  # Route count snapshot for OpenAPI validation

tests/
  smoke/              # Playwright smoke tests (container images)
  integration/        # Playwright module integration tests
fixtures/             # Demo mode fixture data (AI Eng modules)
data/                 # Local dev data (gitignored)
secrets/              # Service account keys (gitignored)

# Symlinked from @org-pulse/core (created by npm run setup):
src/                  # → node_modules/@org-pulse/core/src/
shared/               # → node_modules/@org-pulse/core/shared/
modules/team-tracker/ # → node_modules/@org-pulse/core/modules/team-tracker/
```

## Making Changes

### Branch naming

Use descriptive branch names:
- `feat/description` — new features
- `fix/description` — bug fixes
- `refactor/description` — code improvements

### Development workflow

1. Create a branch from `main`
2. Make your changes
3. Write or update tests for any changed logic
4. Run `npm test` and `npm run lint` to verify
5. Run `npm run build` to confirm the production build works
6. Open a PR against `main`

PRs receive an automated Claude code review that can fix minor issues directly.
The review criteria are defined in
[`.github/instructions/review.instructions.md`](.github/instructions/review.instructions.md).

### Code style & conventions

See [`AGENTS.md`](AGENTS.md) for the full list of code style conventions and
hard constraints. Key points:

- `<script setup>` for new Vue components
- CommonJS (`require`) for server-side code, ES modules for frontend
- No TypeScript — plain JavaScript throughout
- Tailwind CSS utility classes for styling
- No cross-module imports (use `@shared` or API calls)
- Extract reusable logic into composables (`shared/client/composables/`)

### Testing

#### Unit tests

Unit tests use **Vitest** with **jsdom** and **@vue/test-utils**:

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode

# Run a specific test file
npx vitest run modules/team-tracker/server/jira/__tests__/sprint-report.test.js
```

#### Smoke tests

Smoke tests use **Playwright** to verify the production container images work correctly. These run in CI and can also be run locally on any OS (RHEL, macOS, Ubuntu), but do NOT require secrets/credentials to run.

**Note:** First-time image pulls can take a while (~5-10 minutes)

```bash
make build-backend-image   # Build AI Eng backend image (extends core)
make build-frontend-image  # Build AI Eng frontend image (extends core)
make smoke-test            # Run smoke tests against AI Eng images
```

Smoke tests run Playwright in a container, so no local browser installation is needed. The backend runs in demo mode (using fixture data) so no credentials are required.

**macOS note:** The Playwright container bind-mounts your workspace and runs `npm ci`, which installs Linux-native packages into your local `node_modules/`. After running `make smoke-test`, you may need to run `npm ci` again to restore macOS-native packages before running local commands like `npm test` or `npm run dev`.

#### Integration tests

> [!IMPORTANT]
> PRs that modify files in `modules/` (views, components, server routes, server logic) **require** corresponding integration test updates. This is enforced during code review. See [`.github/instructions/review.instructions.md`](.github/instructions/review.instructions.md) for the full policy and exceptions.

Integration tests are run using **Playwright**. They validate that:
1. Modules are visible _and_ clickable from the sidebar
1. Modules load in Org Pulse when clicked
1. Module content renders properly after being loaded

Use `make` to run a module's integration tests:

```bash
MODULE_NAME=ai-impact                   # Choose a testable module
make test-module MODULE=${MODULE_NAME}  # Runs the integration tests against an existing module
```

Available, testable modules can be found here by name: [tests/integration](./tests/integration/)

## Deployment

Deployed to OpenShift via ArgoCD. Kustomize manifests in `deploy/openshift/`.

See `.claude/CLAUDE.md` for full deployment details.

## Questions?

Open an issue or reach out to @accorvin.
