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

export default config;
