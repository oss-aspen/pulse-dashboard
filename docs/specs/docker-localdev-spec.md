# Containerized Local Development Environment — Design Spec

## Goal

Enable contributors to run `docker compose up` (or `make dev-up`) from the `pulse-dashboard` root and get a hot-reloading local development environment backed by **live data** (Jira, GitHub, GitLab, IPA/Sheets roster, and the full `upstream-pulse` service stack), working natively on Apple Silicon (`arm64`) and Linux (`amd64`) with Docker or Podman.

---

## 1. Service Topology (`docker-compose.yml`)

All services share the default Compose bridge network (`pulse-net`). Core dashboard services start unconditionally; the Upstream Pulse stack uses `profiles: ["upstream"]`, which is enabled by default via `COMPOSE_PROFILES=upstream` in `.env.docker.example` (so `docker compose up` runs the full live stack, while contributors working only on `team-tracker` can clear `COMPOSE_PROFILES` or run `make dev-up-core`).

```text
Browser ──► :5173 pulse-frontend (Vite HMR, proxies /api & /modules)
                      │
                      ▼ http://pulse-backend:3001
            :3001 pulse-backend (Express + node --watch, ./data bind mount)
                      │
                      ▼ http://upstream-pulse-backend:4321
            :4321 upstream-pulse-backend (Fastify) ◄──► upstream-pulse-worker (BullMQ)
                      │                                        │
                      ├──► upstream-pulse-postgres (:5432, host :5433)
                      └──► upstream-pulse-redis    (:6379)
                      ▲
            upstream-pulse-migrate (one-shot: npm run db:migrate)
```

| Service | Image / Build | Host Port | Profile | Healthcheck / Dependency |
|---|---|---|---|---|
| `pulse-backend` | `build: { context: ., dockerfile: deploy/dev.Dockerfile }` | `3001:3001` | *(always)* | `GET http://127.0.0.1:3001/api/healthz` |
| `pulse-frontend` | same dev image (`command: ["npx", "vite"]`) | `5173:5173` | *(always)* | `depends_on: pulse-backend (service_healthy)` |
| `upstream-pulse-postgres` | `postgres:16-alpine` | `${UPSTREAM_DB_PORT:-5433}:5432` | `upstream` | `pg_isready -U postgres` |
| `upstream-pulse-redis` | `redis:7-alpine` | `${UPSTREAM_REDIS_PORT:-6379}:6379` | `upstream` | `redis-cli ping` |
| `upstream-pulse-migrate` | `${UPSTREAM_PULSE_DIR:-../upstream-pulse}/backend` | — | `upstream` | `restart: "no"`, runs `npm run db:migrate`, `depends_on` postgres healthy |
| `upstream-pulse-backend` | same build context as migrate (`PORT=4321`) | `4321:4321` | `upstream` | `GET http://127.0.0.1:4321/ready`, `depends_on` migrate `service_completed_successfully` & redis healthy |
| `upstream-pulse-worker` | same build context (`command: ["node", "dist/worker.js"]`) | — | `upstream` | `depends_on` migrate `service_completed_successfully`, postgres & redis healthy |

Note: `pulse-backend` does **not** hard-depend on `upstream-pulse-backend` in `depends_on` so core-only startup (`COMPOSE_PROFILES=""`) works with the same `docker-compose.yml`. The `upstream-pulse` module already handles transient upstream unavailability gracefully via `/health` checks and 90s proxy timeouts.

### Upstream Pulse Image Strategy Decision

| Option | Pros | Cons |
|---|---|---|
| **A. Sibling checkout build context** (`${UPSTREAM_PULSE_DIR:-../upstream-pulse}/backend`) **(Recommended)** | Builds natively on Apple Silicon (`arm64`) & Linux (`amd64`); allows simultaneous edits to `upstream-pulse` + `pulse-dashboard`; works offline / without Quay auth; includes `tsx` + SQL migrations in image. | Requires local clone of `upstream-pulse` (default `../upstream-pulse`, overridable via `UPSTREAM_PULSE_DIR`). |
| **B. Published Quay image** (`quay.io/org-pulse/upstream-pulse-backend:latest`) | No sibling checkout needed; fast pull. | Built **amd64-only** in `upstream-pulse`'s `build-and-push.yml` (`ubuntu-latest`), forcing Rosetta/QEMU emulation on Apple Silicon; cannot test local upstream changes; registry auth risk. |
| **C. Git URL build context** (`https://github.com/dpanshug/upstream-pulse.git#main:backend`) | Native arch build without manual clone. | Breaks on private repos without SSH/token forwarding; inconsistent Podman Compose support for `#ref:subdir`; no local editing; slower cache invalidation. |

**Decision:** Use **Option A** as the default in `docker-compose.yml`. Provide an optional override file `docker-compose.upstream-image.yml` that swaps `build:` for `image: quay.io/org-pulse/upstream-pulse-backend:latest` (with `platform: linux/amd64` documented as a fallback for contributors who don't have a sibling clone).

---

## 2. Dev Dockerfile, `node_modules`, and `@org-pulse/core` Symlinks

### `deploy/dev.Dockerfile`

- **Base image:** `FROM node:22-bookworm-slim` — matches `package.json` `"engines": { "node": ">=22" }` and `.npmrc` `engine-strict=true`. Multi-arch (`linux/arm64` + `linux/amd64`) so Apple Silicon builds and runs **natively** (never pass `--platform linux/amd64`; QEMU emulation breaks `npm`/`esbuild`). `bookworm-slim` (glibc) avoids musl native binary issues with Tailwind v4 (`@tailwindcss/postcss`) and Vite/esbuild.
- **System deps:** Install `curl` (for healthchecks) and `ca-certificates` (for LDAPS/HTTPS).
- **Build steps:**
  ```dockerfile
  FROM node:22-bookworm-slim
  RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
      && rm -rf /var/lib/apt/lists/*
  WORKDIR /app
  ENV PUPPETEER_SKIP_DOWNLOAD=true
  COPY package.json package-lock.json .npmrc ./
  RUN npm ci && sha256sum package-lock.json > /app/node_modules/.lock-hash
  COPY deploy/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
  RUN chmod +x /usr/local/bin/dev-entrypoint.sh
  ENTRYPOINT ["/usr/local/bin/dev-entrypoint.sh"]
  CMD ["node", "--watch-path=server", "--watch-path=modules", "--watch-path=platform", "server/index.js"]
  ```
- **Why `node --watch-path=...` instead of `nodemon`:** Built into Node 22 (zero new dependencies) and scoping `--watch-path` to `server`, `modules`, and `platform` prevents backend restart loops when live sync writes JSON files into `/app/data/`.
- **No impact on `validate:dockerfile-deps`:** `scripts/validate-dockerfile-deps.js` only parses `deploy/osaipo-eng.{frontend,backend}.Dockerfile`.

### Surviving Bind Mounts (`node_modules` & Core Symlinks)

Both `pulse-backend` and `pulse-frontend` mount:
- `.:/app:z` (repo bind mount for instant code edits; `:z` supports SELinux on RHEL/Fedora Podman and is safely ignored on macOS)
- `pulse_node_modules:/app/node_modules` (named volume, preserving Linux-native binaries isolated from macOS host `node_modules`)

**Critical symlink hazard:** `scripts/setup.js` and `@org-pulse/core/scripts/sync-core.js` create **absolute** symlinks (`src`, `modules/team-tracker`, `shared/server`, `shared/client`). If a developer previously ran `npm run setup` on macOS, those symlinks point to `/Users/.../node_modules/@org-pulse/core/...` — dangling inside `/app` — and `sync-core.js` crashes with `EEXIST` because `fs.existsSync()` returns `false` on a broken symlink before calling `fs.symlinkSync()`.

**Solution in `deploy/dev-entrypoint.sh`:**
1. **Lockfile sync (serialized via `pulse-backend` starting before `pulse-frontend`):** Compare `sha256sum /app/package-lock.json` against `/app/node_modules/.lock-hash`. If missing or changed (or `/app/node_modules/@org-pulse/core` is absent), run `npm ci` and update `.lock-hash`.
2. **Relative symlinks (compatible on both container `/app` AND host macOS/Linux):** Always `ln -sfn` relative paths so container startup never breaks host tooling and never hits `EEXIST`:
   - `/app/src` → `node_modules/@org-pulse/core/src`
   - `/app/modules/team-tracker` → `../node_modules/@org-pulse/core/modules/team-tracker`
   - `/app/shared/server` → `../node_modules/@org-pulse/core/shared/server`
   - `/app/shared/client` → `../node_modules/@org-pulse/core/shared/client`
3. **Copy `index.html`:** Copy `/app/node_modules/@org-pulse/core/index.html` to `/app/index.html` if missing or stamp-matched (`<!-- @org-pulse/core -->`).
4. **Optional auto-enable `upstream-pulse`:** On first boot only (when `/app/data/modules-state.json` does not exist and `AUTO_ENABLE_MODULES` is set, e.g. `upstream-pulse`), write `{"team-tracker":true,"upstream-pulse":true}` to `/app/data/modules-state.json` (see §4).
5. `exec "$@"` so signals (`SIGTERM`/`SIGINT`) reach Node/Vite directly.

---

## 3. Environment Variables & Secrets

### Pattern (modeled on 8Knot)

- Ship `.env.docker.example` in git; contributors run `cp .env.docker.example .env` and fill in their real tokens.
- Using `.env` at repo root ensures plain `docker compose up` automatically interpolates `${VAR}` expressions (`COMPOSE_PROFILES`, `UPSTREAM_PULSE_DIR`, ports) AND loads runtime vars via `env_file: [.env]`.
- `docker-compose.yml` explicitly overrides container-network addresses in each service's `environment:` block (taking precedence over `env_file`), so a contributor's existing host `.env` (with `localhost:4321` or `./secrets/...`) continues to work for both host `npm run dev:full` and `docker compose up`.
- **Never bake secrets into images.** `.env` and `secrets/` are already in `.gitignore` and `.dockerignore`. Add `.env.docker` to `.gitignore` as a safeguard.

### Required & Optional Variables (`.env.docker.example`)

| Group | Variable | Required | Default / Example | Notes |
|---|---|---|---|---|
| **Compose** | `COMPOSE_PROFILES` | No | `upstream` | Clear (`COMPOSE_PROFILES=`) to run Pulse without Upstream Pulse |
| **Compose** | `UPSTREAM_PULSE_DIR` | With `upstream` | `../upstream-pulse` | Path to sibling `upstream-pulse` checkout |
| **Pulse Core** | `ADMIN_EMAILS` | Yes | `you@redhat.com` | Seeds `data/roles.json` & local-dev fallback user |
| **Pulse Core** | `JIRA_HOST` | No | `https://redhat.atlassian.net` | Jira Cloud base URL |
| **Pulse Core** | `JIRA_EMAIL` | Yes | `you@redhat.com` | Jira Basic auth email |
| **Pulse Core** | `JIRA_TOKEN` | Yes | *(user token)* | Jira Cloud API token |
| **Shared** | `GITHUB_TOKEN` | **Yes** (with `upstream`) | `ghp_...` | Classic PAT (`read:user`, `repo`, `read:org`). **Hard-required** by `upstream-pulse` `validateConfig()` on startup |
| **Pulse / Module** | `GITLAB_TOKEN` | No | `glpat-...` | GitLab PAT (`read_api`); used by `team-tracker` & `upstream-pulse` PyTorch access |
| **Pulse / Module** | `GITLAB_TEAM_DATA_PROJECT_ID` | No | `82624331` | GitLab project containing `github-access.json` |
| **Pulse Roster** | `IPA_BIND_DN`, `IPA_BIND_PASSWORD` | No | *(service account)* | IPA LDAP (`ipa.corp.redhat.com` LDAPS); **requires Red Hat VPN active on host** |
| **Pulse Roster** | `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | No | `/etc/secrets/google-sa-key.json` | Set in compose `environment:`; place JSON key in host `./secrets/google-sa-key.json` |
| **Pulse Modules** | `UPSTREAM_PULSE_API_URL` | No | `http://upstream-pulse-backend:4321` | Overridden in compose `environment:` for `pulse-backend` |
| **Upstream Pulse** | `GITHUB_TEAM_TOKEN` | No | `${GITHUB_TOKEN}` | PAT with `read:org` for GitHub org member sync |
| **Upstream Pulse** | `GITHUB_TEAM_ORG` | No | `opendatahub-io` | Comma-separated GitHub orgs to sync team members from |
| **Upstream Pulse** | `ORG_NAME` | No | `Red Hat` | Displayed in Upstream Pulse config |
| **Upstream Pulse** | `TEAM_EMAIL_DOMAIN` | No | `redhat.com` | Email domain for contributor resolution |
| **Upstream Pulse** | `UPSTREAM_ADMIN_USERS` | No | `roster-sync-service` | Mapped to `ADMIN_USERS` on `upstream-pulse-backend` (required for `roster-push`; see §6) |
| **Upstream Pulse** | `GOOGLE_AI_API_KEY` | No | *(empty)* | Optional Gemini API key for insight generation |

### Mounted Secrets & VPN Notes

- **Google SA Key:** Mount `./secrets:/etc/secrets:ro,z` into `pulse-backend`. Create empty `./secrets/.gitkeep` or have `make dev-up` run `mkdir -p data secrets` before Compose starts so Docker doesn't create root-owned directories.
- **Red Hat VPN (IPA LDAP & internal GitLab):** Containers inherit host routing/DNS from Docker Desktop / Podman machine, so IPA LDAP (`ipa.corp.redhat.com:636`) works when Red Hat VPN is connected on the host. If VPN is connected *after* starting Podman machine on macOS and DNS fails inside containers, restart the Podman machine (`podman machine stop && podman machine start`) or Docker Desktop.

---

## 4. Data Persistence & First-Run Live Bootstrap

### Storage Layout

| Data | Mechanism | Reason |
|---|---|---|
| Pulse JSON store (`roles.json`, `modules-state.json`, `org-roster-full.json`, `people/`, `snapshots/`) | Bind mount `./data:/app/data:z` | Matches host dev (`./data/`), easily inspectable/editable on host, gitignored, survives `docker compose down`. |
| Upstream Pulse Postgres | Named volume `upstream_pulse_pgdata:/var/lib/postgresql/data` | Native filesystem performance & correct Postgres UID ownership across macOS/Linux. |
| Upstream Pulse Redis | Named volume `upstream_pulse_redisdata:/data` | Preserves BullMQ job queues/schedules across restarts. |
| Node dependencies | Named volume `pulse_node_modules:/app/node_modules` | Isolates Linux native binaries from macOS host `node_modules`. |

Note: `pulse-backend` attempts optional MongoDB connection when `MONGODB_URI` is unset; catching `mongodb-memory-server` absent logs `[database] Continuing without MongoDB — context.db will be null` and uses `./data` filesystem storage cleanly. No MongoDB container is needed.

### First-Run Live Data Flow

1. **Pulse role seeding (automatic):** On first boot with empty `./data`, `seedRoles()` writes `data/roles.json` with all emails in `ADMIN_EMAILS` assigned the `admin` role.
2. **Upstream Pulse module activation (automatic):** `modules/upstream-pulse/module.json` sets `"defaultEnabled": false`. Because `dev-entrypoint.sh` seeds `data/modules-state.json` with `{"team-tracker":true,"upstream-pulse":true}` when the file is missing and `AUTO_ENABLE_MODULES=upstream-pulse` is set, `/api/modules/upstream-pulse/*` mounts on first boot without requiring a manual enable + restart. (If `./data/modules-state.json` already exists with `upstream-pulse: false`, enable via Settings → Modules or `POST /api/admin/modules/upstream-pulse/enable` followed by `docker compose restart pulse-backend`.)
3. **Upstream Pulse DB schema (automatic):** `upstream-pulse-migrate` runs `npm run db:migrate` (Drizzle SQL migrations in `src/shared/database/migrations/`) before `upstream-pulse-backend` and `upstream-pulse-worker` start. (Note: `upstream-pulse/backend/Dockerfile` retains `src/` and `tsx` via `npm ci`, so `npm run db:migrate` works directly in the built image; `/.env` does not exist in-container, so `dotenv` in `config/index.ts` does not clobber Compose env vars.)
4. **Pulse roster & metrics population (live):**
   - Open `http://localhost:5173` → **Settings** → configure Org Roots (e.g., `shgriffi`) and Google Sheet ID, click **Sync Now** (requires Red Hat VPN + `IPA_*` / Google SA key).
   - Trigger full live refresh across all handlers:
     ```bash
     curl -X POST "http://localhost:3001/api/admin/refresh-all?force=true"
     ```
5. **Upstream Pulse live data population:** Do **not** auto-run `db:seed` (it inserts fake team members `alicej`/`bsmith`). Populate with real data via API or UI:
   - Push real Org Pulse roster into Upstream Pulse: `curl -X POST http://localhost:3001/api/modules/upstream-pulse/roster-push` (also runs automatically every 2h) — or sync from GitHub org: `curl -X POST http://localhost:4321/api/admin/team-sync`.
   - Track a real upstream repository via Upstream Pulse UI or API (worker immediately runs live GitHub collection):
     ```bash
     curl -X POST http://localhost:4321/api/projects -H "Content-Type: application/json" \
       -d '{"name":"Kubeflow","githubOrg":"kubeflow","githubRepo":"kubeflow","startCollection":true}'
     ```

---

## 5. Vite Proxy & Hot Reload (`vite.config.mjs`)

`@org-pulse/core/vite` currently hardcodes `target: 'http://localhost:3001'` for both `/api` and `/modules` and leaves `server.host` unset (loopback only). Update `pulse-dashboard/vite.config.mjs` to apply env-driven overrides while preserving the `/modules` `bypass()` hook and keeping host `npm run dev` defaults unchanged:

```js
import { createViteConfig } from '@org-pulse/core/vite';

const config = createViteConfig();
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3001';

config.server.host = process.env.VITE_HOST || 'localhost';
config.server.proxy['/api'].target = apiTarget;
config.server.proxy['/modules'].target = apiTarget;

if (process.env.VITE_USE_POLLING === 'true') {
  config.server.watch = { usePolling: true, interval: 300 };
}

export default config;
```

In `docker-compose.yml`, `pulse-frontend` sets:
- `VITE_HOST=0.0.0.0` (reachable from host browser on `localhost:5173`)
- `VITE_API_TARGET=http://pulse-backend:3001` (routes `/api` and `/modules` over Compose DNS)
- `VITE_DEMO_MODE=${VITE_DEMO_MODE:-false}`
- `VITE_USE_POLLING=${VITE_USE_POLLING:-false}` (set `true` only if host filesystem events don't propagate on an older Podman/Docker setup)

---

## 6. Local Authentication Behavior

- **Pulse Backend (no OAuth proxy locally):** `PROXY_AUTH_SECRET` is unset (proxy guard disabled). For every request without `Authorization: Bearer tt_...` or `X-Forwarded-Email`, `shared/server/auth.js` identifies the caller as the **first email in `ADMIN_EMAILS`** (fallback `local-dev@redhat.com`), with `authMethod: "local-dev"` and `isAdmin: true`. To test non-admin or another user's view, send `-H "X-Forwarded-Email: other@redhat.com"`.
- **Upstream Pulse Backend (`NODE_ENV=development`):**
  - Regular UI/proxy requests from `pulse-backend` omit `x-forwarded-*` headers locally, so `upstream-pulse` uses `DEV_IDENTITY` (`isAdmin: true`).
  - **Important edge case:** `modules/upstream-pulse/server/index.js` (`pushRosterToUpstream`) explicitly sends `x-forwarded-user: roster-sync-service` and `x-forwarded-email: roster-sync-service@internal`. When those headers are present, `upstream-pulse`'s `identity.ts` checks `ADMIN_USERS` instead of using `DEV_IDENTITY`. Therefore `docker-compose.yml` sets `ADMIN_USERS: ${UPSTREAM_ADMIN_USERS:-roster-sync-service}` on `upstream-pulse-backend` so roster pushes are authorized out of the box.

---

## 7. CollectOSS Connection

### Consumer & Current Implementation Status

Per `upstream-pulse/docs/collectoss-adapter-design.excalidraw` (*Phase 1: Read-Only Data Adapter*), **CollectOSS (formerly Augur)** is consumed exclusively by **`upstream-pulse-backend` and `upstream-pulse-worker`** (`collection-worker` via the planned `AugurAdapter` + `RepoResolver` reading the `augur_data` PostgreSQL schema to populate Upstream Pulse's `contributions` table). `pulse-dashboard` does **not** connect to CollectOSS Postgres directly — it remains a display layer calling `upstream-pulse-backend` over HTTP (`UPSTREAM_PULSE_API_URL`, per `AGENTS.md` constraint #3).

> **Scope note:** As of this spec, no CollectOSS/Augur client code or env-var parsing exists yet in `upstream-pulse` or `pulse-dashboard` (only the Excalidraw adapter design doc). This spec therefore scopes local dev to **env-var wiring, container-to-host networking, and a standalone connectivity check (`make dev-check-collectoss`)** so the runtime plumbing is ready when `AugurAdapter` lands.

### Default Mode: External / Existing CollectOSS Database (8Knot Pattern)

Default local dev connects to an **existing external CollectOSS PostgreSQL instance** (either directly over Red Hat VPN or via a local SSH/`oc` port-forward such as `localhost:5411`, matching 8Knot's `env.list` workflow):

- **Env-var naming (`COLLECTOSS_*` primary, `AUGUR_*` fallback):** Standardize on `COLLECTOSS_*` in `.env.docker.example` to match the CollectOSS rebrand and `collectoss-dev`'s own naming, while passing Compose fallback interpolation from `AUGUR_*` into `upstream-pulse-backend` and `upstream-pulse-worker`. This lets contributors drop an existing 8Knot `env.list` block straight into `.env` without renaming keys (`AUGUR_LOGIN_ENABLED` is intentionally omitted — it is 8Knot OAuth UI config only):
  ```yaml
  environment:
    COLLECTOSS_HOST: ${COLLECTOSS_HOST:-${AUGUR_HOST:-}}
    COLLECTOSS_PORT: ${COLLECTOSS_PORT:-${AUGUR_PORT:-5432}}
    COLLECTOSS_DATABASE: ${COLLECTOSS_DATABASE:-${AUGUR_DATABASE:-augur}}
    COLLECTOSS_SCHEMA: ${COLLECTOSS_SCHEMA:-${AUGUR_SCHEMA:-augur_data}}
    COLLECTOSS_USERNAME: ${COLLECTOSS_USERNAME:-${AUGUR_USERNAME:-}}
    COLLECTOSS_PASSWORD: ${COLLECTOSS_PASSWORD:-${AUGUR_PASSWORD:-}}
  ```
  All `.env.docker.example` values must be placeholders only (e.g., `COLLECTOSS_USERNAME=<your-readonly-db-user>`, `COLLECTOSS_PASSWORD=<your-db-password>`, `COLLECTOSS_PORT=5411`).
- **Docker vs. Podman host networking:** Add `extra_hosts: ["host.docker.internal:host-gateway"]` to `upstream-pulse-backend` and `upstream-pulse-worker`. When connecting through a local host tunnel/port-forward:
  - **Docker (macOS/Linux):** set `COLLECTOSS_HOST=host.docker.internal`
  - **Podman (macOS/Linux):** set `COLLECTOSS_HOST=host.containers.internal`
  - **Direct remote DB over VPN:** set `COLLECTOSS_HOST=<db-hostname-or-ip>`
- **Read-only DB user (strongly recommended):** Phase 1 is strictly read-only. Contributors should authenticate with a PostgreSQL role restricted to `SELECT` on `augur_data.*`, and the adapter/connectivity check should enforce `default_transaction_read_only=on` so local dev can never mutate a shared CollectOSS database.

### Optional Self-Hosted CollectOSS Mode — Recommendation: Docs-Only

Do **not** add a `--profile collectoss` to `pulse-dashboard/docker-compose.yml`. Inspecting `../collectoss-dev/docker-compose.yml` shows a 5-container stack (`database` custom build, `redis`, `keyman` custom build, `rabbitmq:4.1-management-alpine`, and `core` Celery + Facade git-cloning workers with custom UIDs `2345`/`3456`, `post_start: chmod 777`, and port conflicts on `5432`/`6379`). Moreover, a fresh self-hosted CollectOSS DB starts empty and requires hours of GitHub/GitLab harvesting before `AugurAdapter` has usable data.

Instead, document in `README.md` / `CONTRIBUTING.md`: contributors who want a local CollectOSS instance should either run `docker compose up` inside `../collectoss-dev` independently or restore CollectOSS's sample database dump (`docs.collectoss.org`), then point `COLLECTOSS_HOST` (`host.docker.internal` / `host.containers.internal`) and `COLLECTOSS_PORT` at it.

### Connectivity Verification (`make dev-check-collectoss`)

Add a Makefile target that runs an ephemeral `postgres:16-alpine` container (requiring no host `psql` install) with `--add-host=host.docker.internal:host-gateway --env-file .env`:
1. Resolves `COLLECTOSS_*` with `AUGUR_*` fallbacks (failing fast if `COLLECTOSS_HOST`/`AUGUR_HOST` is empty).
2. Runs `pg_isready -h "$HOST" -p "$PORT" -U "$USER" -d "$DB"` to confirm container-to-DB network reachability.
3. Runs a read-only probe: `PGPASSWORD="$PASS" PGOPTIONS="-c default_transaction_read_only=on" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -c "SELECT count(*) AS repo_count FROM ${SCHEMA}.repo;"` to verify credentials and `augur_data` schema access.

---

## 8. Developer UX

### Makefile Targets

Add a `COMPOSE` macro using the existing `CONTAINER_RUNTIME` auto-detection (`podman` or `docker`), mirroring 8Knot's Podman-first compatibility:

```makefile
COMPOSE ?= $(CONTAINER_RUNTIME) compose
```

| Target | Command | Purpose |
|---|---|---|
| `make dev-up` | `mkdir -p data secrets && $(COMPOSE) up --build -d` | Start full live stack (respects `COMPOSE_PROFILES` in `.env`, default `upstream`) |
| `make dev-up-core` | `mkdir -p data secrets && COMPOSE_PROFILES= $(COMPOSE) up --build -d` | Start only Pulse frontend + backend (no `upstream-pulse` checkout required) |
| `make dev-up-demo` | `mkdir -p data secrets && COMPOSE_PROFILES= $(COMPOSE) -f docker-compose.yml -f docker-compose.demo.yml up --build -d` | Start Pulse in fixture-backed demo mode (no credentials required) |
| `make dev-down` | `$(COMPOSE) --profile upstream down` | Stop and remove all dev containers (keeps `./data` and DB volumes) |
| `make dev-logs` | `$(COMPOSE) --profile upstream logs -f` | Follow logs across all running services |
| `make dev-status` | `$(COMPOSE) --profile upstream ps` | Show container health and port mappings |
| `make dev-check-collectoss` | Ephemeral `postgres:16-alpine` `pg_isready` + read-only `psql` check | Verify container reachability, credentials, and `augur_data.repo` access for CollectOSS |
| `make dev-reset` | `$(COMPOSE) --profile upstream down -v` | Stop containers and wipe named volumes (`node_modules`, Postgres, Redis); leaves `./data` intact (prints note to `rm -rf data` for full Pulse wipe) |

### Demo Override (`docker-compose.demo.yml`)

Sets `DEMO_MODE=true` on `pulse-backend` and `VITE_DEMO_MODE=true` on `pulse-frontend`, and clears `AUTO_ENABLE_MODULES` so fixture mode works identically to `DEMO_MODE=true npm run dev:full` with zero credentials.

### Relationship to `setup-localdev.sh`

**Keep and extend** `setup-localdev.sh` with a `--docker` flag (preserving host-mode bare-metal dev for contributors who prefer it):
- `./setup-localdev.sh --docker [--start]` verifies `docker`/`podman` + `compose` (skipping Homebrew Node install & host `npm install`), copies `.env.docker.example` → `.env` (defaulting to **live mode** when `--docker` is passed, unless `--demo` is also passed), checks `UPSTREAM_PULSE_DIR` (warns with `make dev-up-core` fallback if absent), creates `data/` and `secrets/`, and runs `make dev-up` if `--start` is set.
- Fix the header usage comment in `setup-localdev.sh` (`./setup-localdev.sh`, not `./scripts/setup-localdev.sh`).

---

## 9. Documentation & CI Impact

Per `AGENTS.md` rule 8 (Makefile commands & contributor docs must land in the same PR):
- **`README.md`:** Add a "Quick Start (Docker — Live Data)" section covering `cp .env.docker.example .env`, sibling `upstream-pulse` checkout, CollectOSS DB connection (`COLLECTOSS_*` / `AUGUR_*` & `host.docker.internal` vs `host.containers.internal`), `make dev-up`, and initial data sync; add all `make dev-*` targets (including `dev-check-collectoss`) to the **Commands** section.
- **`CONTRIBUTING.md`:** Document the containerized dev workflow alongside host dev, Podman/Docker parity, Apple Silicon native `arm64` behavior, standalone CollectOSS / sample-DB option, and the Red Hat VPN requirement for IPA LDAP.
- **`.github/workflows/ci.yml`:**
  - Extend `detect-changes` regex (`deploy` output) to match `^(deploy/|docker-compose.*\.yml|\.env\.docker\.example)`.
  - Add a `Validate Docker Compose config` step under `test` (when `deploy == 'true'`):
    ```bash
    cp .env.docker.example .env
    docker compose config --quiet
    COMPOSE_PROFILES=upstream docker compose config --quiet
    docker compose -f docker-compose.yml -f docker-compose.demo.yml config --quiet
    docker compose -f docker-compose.yml -f docker-compose.upstream-image.yml config --quiet
    rm -f .env
    ```
  - Do **not** run `docker compose up` in CI (live mode requires credentials and a sibling checkout). Existing `smoke-test-osaipo-eng` continues validating production images unchanged.

---

## 10. Acceptance Criteria & Verification Steps

A contributor or verifying agent can validate the implementation end-to-end with:

1. **Compose syntax validation (all profiles & overrides):**
   ```bash
   cp .env.docker.example .env   # or populate real creds
   docker compose config --quiet
   COMPOSE_PROFILES=upstream docker compose config --quiet
   docker compose -f docker-compose.yml -f docker-compose.demo.yml config --quiet
   ```
   *Pass:* All exit `0` with no errors.
2. **Full live stack startup & health:**
   ```bash
   # With real JIRA_EMAIL, JIRA_TOKEN, ADMIN_EMAILS, GITHUB_TOKEN in .env
   # and ../upstream-pulse checked out:
   make dev-up
   make dev-status
   ```
   *Pass:* `pulse-backend`, `pulse-frontend`, `upstream-pulse-postgres`, `upstream-pulse-redis`, `upstream-pulse-backend`, and `upstream-pulse-worker` are running/healthy; `upstream-pulse-migrate` exited `0`; `docker inspect` confirms native `arm64` on Apple Silicon.
3. **Auth & live Pulse API:**
   ```bash
   curl -sf http://localhost:3001/api/healthz            # {"status":"ok"}
   curl -sf http://localhost:3001/api/whoami             # isAdmin:true, authMethod:"local-dev", email == ADMIN_EMAILS[0]
   curl -sf http://localhost:3001/api/admin/secrets/status  # JIRA_TOKEN & GITHUB_TOKEN configured:true
   curl -sf -X POST "http://localhost:3001/api/admin/refresh-all?force=true"  # HTTP 202 {"status":"started",...}
   ```
   *Pass:* Returns live non-demo responses (no `"Refresh disabled in demo mode"`).
4. **Frontend UI & Vite proxy:**
   ```bash
   curl -sf http://localhost:5173/ | grep -q '@org-pulse/core'
   curl -sf http://localhost:5173/api/healthz            # {"status":"ok"} (proves container-to-container proxy)
   ```
   Open `http://localhost:5173` in a browser — sidebar loads with Team Tracker and Upstream Pulse (no demo banner, no console errors).
5. **Upstream Pulse integration & CollectOSS connectivity:**
   ```bash
   curl -sf http://localhost:4321/ready                  # {"status":"ready","database":"connected"}
   curl -sf http://localhost:3001/api/modules/upstream-pulse/config   # proxies to upstream-pulse-backend:4321
   curl -sf http://localhost:3001/api/modules/upstream-pulse/projects # returns live DB projects JSON
   make dev-check-collectoss                             # pg_isready ok + prints augur_data.repo count (when configured)
   ```
   Open Upstream Pulse → Dashboard in `http://localhost:5173` — fetches live data from the containerized `upstream-pulse-backend`; `docker compose exec upstream-pulse-backend env | grep COLLECTOSS_` confirms env vars are wired.
6. **Hot reload (frontend + backend):**
   - Edit a visible label in `modules/upstream-pulse/client/views/DashboardView.vue` → browser updates via Vite HMR within ~2s without full container rebuild.
   - Touch `modules/upstream-pulse/server/index.js` → `docker compose logs pulse-backend` shows `node --watch` restarting cleanly while `data/` writes do **not** trigger restarts.
7. **Core-only & Demo fallbacks:**
   - `make dev-down && make dev-up-core` starts only Pulse without requiring `../upstream-pulse`.
   - `make dev-down && make dev-up-demo` loads fixture data without credentials.
8. **Existing CI checks remain green:** `npm run lint`, `npm test`, `npm run validate:modules`, `npm run validate:openapi`, `npm run validate:dockerfile-deps`.

---

## 11. File Manifest & Risks / Open Questions

### Files to Create or Modify

| Action | Path | Purpose |
|---|---|---|
| **New** | `docker-compose.yml` | Core Pulse + profiled Upstream Pulse live dev stack + CollectOSS env wiring & `host.docker.internal` |
| **New** | `docker-compose.demo.yml` | Demo/fixture-mode Compose override (no credentials needed) |
| **New** | `docker-compose.upstream-image.yml` | Optional override using published Quay image instead of sibling build |
| **New** | `deploy/dev.Dockerfile` | Multi-arch Node 22 dev image for `pulse-backend` & `pulse-frontend` |
| **New** | `deploy/dev-entrypoint.sh` | Lockfile sync, relative `@org-pulse/core` symlinks, first-run module state |
| **New** | `.env.docker.example` | Live dev env template covering Pulse + Upstream Pulse + CollectOSS (`COLLECTOSS_*`) + Compose vars |
| **Modify** | `vite.config.mjs` | Support `VITE_HOST`, `VITE_API_TARGET`, `VITE_USE_POLLING` env overrides |
| **Modify** | `Makefile` | Add `COMPOSE` macro and `dev-up`, `dev-up-core`, `dev-up-demo`, `dev-down`, `dev-logs`, `dev-status`, `dev-check-collectoss`, `dev-reset` |
| **Modify** | `setup-localdev.sh` | Add `--docker` flag (defaults to live `.env.docker.example`) and fix header usage path |
| **Modify** | `.gitignore` | Add `.env.docker` safeguard |
| **Modify** | `.github/workflows/ci.yml` | Expand `detect-changes` and run `docker compose config --quiet` checks |
| **Modify** | `README.md` | Add Docker Live Dev Quick Start (incl. CollectOSS setup) and document `make dev-*` targets |
| **Modify** | `CONTRIBUTING.md` | Document Docker/Podman local dev workflow, standalone CollectOSS option, Apple Silicon & VPN notes |

### Risks & Open Questions

1. **CollectOSS adapter not yet implemented in `upstream-pulse`:** `AugurAdapter` currently exists only as a design (`collectoss-adapter-design.excalidraw`). When implemented, align its env-var names with the `COLLECTOSS_*` contract defined in §7 (or derive `COLLECTOSS_DATABASE_URL` in Compose if the adapter prefers a single URI).
2. **Docker vs. Podman host-gateway hostname mismatch:** Local port-forwarded CollectOSS DBs need `host.docker.internal` on Docker vs. `host.containers.internal` on Podman. Mitigation: `extra_hosts` enables `host.docker.internal` everywhere on Docker, and `make dev-check-collectoss` surfaces hostname/DNS issues immediately before app debugging.
3. **Upstream Pulse `GITHUB_TOKEN` hard failure:** `upstream-pulse` exits on startup if `GITHUB_TOKEN` is empty (and governance/leadership still require GitHub API even with CollectOSS). Mitigation: document clearly in `.env.docker.example` and provide `make dev-up-core` for contributors without a GitHub PAT.
4. **Podman/Docker VPN DNS drift on macOS:** Connecting to Red Hat VPN after the VM has booted can leave stale `/etc/resolv.conf` inside the VM, breaking `ipa.corp.redhat.com` LDAPS or remote CollectOSS DB hostnames. Mitigation: document VM restart in troubleshooting.
5. **Host vs. container symlink permissions on Linux:** `dev-entrypoint.sh` runs as root inside the dev container by default; bind-mounted `./data` files on Linux could be root-owned. Mitigation: consider `user: "${UID:-1000}:${GID:-1000}"` (or `USER node`) if Linux contributors hit ownership issues; on macOS VirtioFS/Podman Desktop, host UID mapping handles this transparently.
6. **Published `upstream-pulse` image multi-arch:** Currently `upstream-pulse`'s `build-and-push.yml` only builds `linux/amd64`. If the team later adds `platforms: linux/amd64,linux/arm64` there, `docker-compose.upstream-image.yml` becomes native on Apple Silicon too.
7. **Pre-existing `modules-state.json`:** Contributors with an existing host `./data/modules-state.json` where `upstream-pulse: false` won't be overwritten by first-run seeding; document the one-time toggle via Settings → Modules or `POST /api/admin/modules/upstream-pulse/enable` + restart.

---

## 12. Review Decisions (SUPERSEDES anything above where they conflict)

Advisory review (Fable 5.2) + orchestrator review. Coders implement §1–11 **as amended here**.

### 12.1 File split (removes coder coupling)
- `docker-compose.yml` (Coder A) — pulse services, `pulse_node_modules` volume, and a top-level
  `include: [docker-compose.upstream.yml]` (Compose ≥ 2.20; we require the docker-compose v2 provider, also under Podman).
- `docker-compose.upstream.yml` (Coder B) — all `upstream-pulse-*` services + their volumes, `profiles: ["upstream"]`.
- `docker-compose.demo.yml` (Coder A).
- **Frozen names:** services `pulse-backend`, `pulse-frontend`, `upstream-pulse-postgres`, `upstream-pulse-redis`,
  `upstream-pulse-migrate`, `upstream-pulse-backend`, `upstream-pulse-worker`. Env names: `DEMO_MODE`, `VITE_DEMO_MODE`,
  `VITE_API_TARGET`, `VITE_USE_POLLING`, `SKIP_INSTALL`, `UPSTREAM_PULSE_API_URL`, `UPSTREAM_PULSE_DIR`, `COMPOSE_PROFILES`,
  `COLLECTOSS_HOST/PORT/DATABASE/SCHEMA/USERNAME/PASSWORD`.

### 12.2 Correctness fixes
1. Base compose sets `DEMO_MODE: "false"` and `VITE_DEMO_MODE: "false"` **literally** in `environment:` (not interpolated);
   only `docker-compose.demo.yml` flips them. `make dev-up` warns if `.env` contains `DEMO_MODE=true`.
2. Upstream wiring: postgres gets `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=password` (local-only), `POSTGRES_DB=upstream_pulse`.
   migrate/backend/worker get `DATABASE_URL=postgresql://postgres:password@upstream-pulse-postgres:5432/upstream_pulse`,
   `REDIS_URL=redis://upstream-pulse-redis:6379`, `NODE_ENV=development`; backend also `PORT=4321`, `ADMIN_USERS`.
3. Upstream healthcheck uses `wget -qO- http://127.0.0.1:4321/ready` (alpine image, no curl). Pulse dev image has curl.
4. **Cut** `docker-compose.upstream-image.yml`.
5. `COMPOSE_PROFILES=upstream` stays the default; `make dev-up` preflights `$(UPSTREAM_PULSE_DIR)` exists and `GITHUB_TOKEN`
   is non-empty, failing with a hint to `make dev-up-core`.
6. Do NOT `env_file: .env` on upstream services — pass an explicit `environment:` list (GITHUB_TOKEN, GITHUB_TEAM_*, ORG_NAME,
   TEAM_EMAIL_DOMAIN, GOOGLE_AI_API_KEY, COLLECTOSS_*) so Jira/IPA secrets don't leak in. Pulse services may use `env_file`.
7. Do not publish Redis to the host (collides with 8Knot/CollectOSS). Postgres stays on host `${UPSTREAM_DB_PORT:-5433}`.
8. Backend watch: use `node --watch server/index.js` (watches the require graph, ignores data/). Not `--watch-path`.
9. Vite: `command: ["npx","vite","--host","0.0.0.0"]`; drop `VITE_HOST` var. Keep `VITE_API_TARGET`, `VITE_USE_POLLING`.

### 12.3 Design fixes
- Entrypoint symlinks: relative `ln -sfn`, `mkdir -p shared` first, and **skip (warn) if the target path is a real directory**.
- Only `pulse-backend` runs `npm ci`; `pulse-frontend` sets `SKIP_INSTALL=1` and waits for `/app/node_modules/.lock-hash`
  to match (poll ≤120s) before exec.
- Run as non-root: dev.Dockerfile `chown -R node:node /app` (incl. node_modules before volume creation) and `USER node`.
  Docs mention `user:` override for hosts whose UID ≠ 1000.
- Host addressing: document **only** `host.docker.internal` (+ `extra_hosts: host.docker.internal:host-gateway`); note Podman ≥ 5.x.
  Linux tunnels must bind `0.0.0.0` (`oc port-forward --address 0.0.0.0 …` / `ssh -L 0.0.0.0:5411:…`).

### 12.4 Scope cuts / keeps
- **Cut:** AUTO_ENABLE_MODULES entrypoint seeding (violates AGENTS.md rule 2). Instead `make dev-enable-upstream` calls
  `POST /api/admin/modules/upstream-pulse/enable` then restarts pulse-backend; README documents it as a one-time step.
- **Cut:** AUGUR_* fallback chain (COLLECTOSS_* only; README shows the 8Knot→COLLECTOSS mapping), `.env.docker` gitignore line,
  `dev-status` target, `setup-localdev.sh --docker` (README `cp .env.docker.example .env && make dev-up` instead; fix only the
  usage-path comment in setup-localdev.sh).
- **Keep (user requirement):** COLLECTOSS_* passed to upstream backend/worker + `make dev-check-collectoss` (read-only probe).
- Keep `dev-logs` (cheap). Targets: `dev-up`, `dev-up-core`, `dev-up-demo`, `dev-down`, `dev-logs`, `dev-reset`,
  `dev-enable-upstream`, `dev-check-collectoss`.
- CI: `docker compose config --quiet` for base, `COMPOSE_PROFILES=upstream` (with a dummy `UPSTREAM_PULSE_DIR` dir), and demo.

### 12.5 Docs
- Coder B writes README/CONTRIBUTING **last**, using `docs/specs/coder-a-notes.md` (≤15 lines written by Coder A:
  symlinks, USER node, polling, SKIP_INSTALL). Update `.env.example` pointer and `.claude/CLAUDE.md` Local Development section.

## 13. Post-implementation corrections

- `upstream-pulse-migrate` runs `node dist/shared/database/run-migrate.js`; current upstream images ship compiled `dist/` output rather than `tsx`.
- CollectOSS wiring now matches upstream `main`: `COLLECTOSS_DATABASE_URL`, `COLLECTOSS_SCHEMA` (default `data`, or `augur_data` for legacy Augur), `DEFAULT_DATA_SOURCE`, and `COLLECTOSS_FALLBACK_TO_GITHUB` replace the earlier host/port/database/username/password variables.
- The original sibling checkout was on a stale `dev` branch without current CollectOSS support; use upstream `main` when schema columns or tables are missing.
- `make dev-up` runs an idempotent first-run bootstrap (`scripts/dev-bootstrap.sh`) that enables Upstream Pulse when needed and queues GitHub team sync only when no team members exist; `make dev-enable-upstream` remains a manual alias.
