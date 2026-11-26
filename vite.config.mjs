import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { createViteConfig } from '@org-pulse/core/vite';
import { shadowCorePlugin } from './scripts/shadow-plugin.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'));

const config = createViteConfig();

// Per-file shadowing of core frontend sources: files under app/ that mirror
// core package paths replace their counterparts at build time. See
// app/README.md for the takeover workflow.
const plugins = Array.isArray(config.plugins) ? config.plugins : [];
config.plugins = [...plugins, shadowCorePlugin({ coreDir, appDir: path.join(__dirname, 'app') })];

// Docker dev: route /api and /modules to the backend container.
const apiTarget = process.env.VITE_API_TARGET;
if (apiTarget) {
  config.server.proxy['/api'].target = apiTarget;
  config.server.proxy['/modules'].target = apiTarget;
}

// Only needed when host filesystem events don't reach the container.
if (process.env.VITE_USE_POLLING === 'true') {
  config.server.watch = { usePolling: true, interval: 300 };
}

export default config;
