import { mergeConfig, loadEnv } from 'vite'
import { createViteConfig } from '@org-pulse/core/vite'
import { disableCommandPalettePlugin } from './build/disable-command-palette.js'
import { staticHostPlugin } from './static-host/vite-plugin.mjs'

export default function defineConsumerViteConfig({ mode } = {}) {
  const env = loadEnv(mode || 'development', process.cwd(), '')
  const staticHost = process.env.VITE_STATIC_HOST === 'true' || env.VITE_STATIC_HOST === 'true'

  return mergeConfig(
    {
      // Plugin must run before core's vue() plugin (both enforce: 'pre')
      // so module-loader globs, useBackendHealth, and main.js are rewritten first.
      plugins: [
        disableCommandPalettePlugin(),
        ...(staticHost ? [staticHostPlugin()] : [])
      ],
      base: staticHost ? (process.env.VITE_BASE || env.VITE_BASE || './') : (process.env.VITE_BASE || env.VITE_BASE || '/')
    },
    createViteConfig()
  )
}
