import { mergeConfig } from 'vite'
import { createViteConfig } from '@org-pulse/core/vite'
import { staticHostPlugin } from './static-host/vite-plugin.js'

const staticHost = process.env.VITE_STATIC_HOST === 'true'

export default mergeConfig(
  createViteConfig(),
  {
    base: staticHost ? (process.env.VITE_BASE || './') : (process.env.VITE_BASE || '/'),
    plugins: staticHost ? [staticHostPlugin()] : []
  }
)
