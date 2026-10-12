# app/ — your shadow of the core frontend

This directory is **yours**. Files here mirror paths relative to the
`@org-pulse/core` package root and replace their core counterparts at build
time (dev and production image). Anything you don't own keeps flowing from
core and updates when `CORE_VERSION` bumps.

## Take over a file

```bash
npm run own-file -- src/components/AppSidebar.vue   # core src/
npm run own-file -- shared/client/components/Card.vue  # shared client components
```

This copies the file to `app/<path>`, records a base snapshot in
`app/owned.json`, and from then on the build uses your copy. Edit it freely.

Check what you own and whether core drifted:

```bash
npm run owned-files
```

Give a file back to core: delete the `app/` copy and its `app/owned.json`
entry.

## What's shadowable

| Surface | Mechanism |
|---|---|
| `src/**` (app shell: App, AppSidebar, views, palette, theme) | `@/` imports, relative imports, `/src/main.js` entry |
| `shared/client/**` (cards, tables, forms used inside module views) | `@shared/` imports |
| `index.html` | already consumer-owned (tracked at repo root); the image build copies it. Remove the `<!-- @org-pulse/core -->` stamp to stop `npm run setup` from overwriting it |
| tailwind theme | locally: edit the tracked `tailwind.config.mjs` wrapper. In the image, core's factory config applies (identical while the wrapper passes no options). To customize theme tokens in prod: `npm run own-file -- src/style.css`, keep its `@config "../tailwind.config.mjs"` line (resolves to `app/tailwind.config.mjs` for the shadowed copy), and add your `app/tailwind.config.mjs` wrapping `createTailwindConfig()` with your overrides |
| `modules/<slug>/**` (e.g. team-tracker) | **not** per-file shadowable (directory glob discovery) — replace the module's symlink in `modules/` with a real directory; core's `sync-core.js` deliberately skips non-symlinks, so the takeover sticks |
| `platform/**` | already yours |

## How it works

`vite.config.mjs` appends a `enforce: 'pre'` resolve plugin
(`scripts/shadow-plugin.mjs`) that intercepts module resolution before
Vite's alias handling. If a module id points at a core file that has an
`app/` counterpart, the import is redirected; otherwise it falls through to
core untouched. Relative imports from your override files fall back to core
for siblings you haven't taken over, so partial takeovers compose.

## On CORE_VERSION bumps

Run `npm run owned-files`. Files marked `upstream-changed` are safe to
re-own (your copy was unmodified). `diverged` means you edited a file core
also changed — merge by hand, then re-run `own-file` to refresh the base.
The report exits non-zero on divergence, so it can gate CI.
