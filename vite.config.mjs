import { createViteConfig } from '@org-pulse/core/vite';

const config = createViteConfig();

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
