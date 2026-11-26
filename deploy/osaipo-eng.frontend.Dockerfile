# Org Pulse — Frontend
#
# Extends the core frontend builder with specific modules, builds, then
# serves from the core runtime image.

ARG CORE_TAG=latest

# Stage 1: Build with all specific modules
FROM quay.io/osaipo-data/org-pulse-core-frontend-builder:${CORE_TAG} AS build

# Install specific frontend dependencies (core deps already present)
RUN npm install --no-save mermaid @dagrejs/dagre @vue-flow/core @vue-flow/background @vue-flow/controls @vue-flow/minimap

# Add platform customizations
COPY platform/ ./platform/

# Add all non-core modules (core builder already has the main app shell)
COPY modules/ ./modules/

# Consumer-owned build entrypoints: the vite config (copied under a
# distinct name and loaded via --config below — /app/vite.config.mjs must
# stay core's factory so the self-linked '@org-pulse/core/vite' resolves to
# it rather than recursing into the consumer config), the shadow plugin,
# app/ shell overrides, and index.html.
COPY vite.config.mjs ./vite.osaipo.config.mjs
COPY scripts/shadow-plugin.mjs ./scripts/
COPY app/ ./app/
COPY index.html ./

# The builder image ships core source at /app but does not install the core
# package into its own node_modules. Self-link it so '@org-pulse/core/vite'
# (imported by the consumer vite config) resolves to core's factory files.
RUN mkdir -p node_modules/@org-pulse && ln -sfn /app node_modules/@org-pulse/core

RUN npm run build -- --config vite.osaipo.config.mjs

# Stage 2: Serve with hardened nginx
FROM quay.io/osaipo-data/org-pulse-core-frontend-runtime:${CORE_TAG}

COPY --from=build /app/dist /usr/share/nginx/html
