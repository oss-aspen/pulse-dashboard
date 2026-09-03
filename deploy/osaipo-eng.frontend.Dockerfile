# Org Pulse — Frontend
#
# Extends the core frontend builder with specific modules, builds, then
# serves from the core runtime image.

ARG CORE_TAG=latest

# Stage 1: Build with all specific modules
FROM quay.io/osaipo-data/osaipo-pulse-frontend-builder:${CORE_TAG} AS build

# Install specific frontend dependencies (core deps already present)
RUN npm install --no-save mermaid @dagrejs/dagre @vue-flow/core @vue-flow/background @vue-flow/controls @vue-flow/minimap

# Add platform customizations
COPY platform/ ./platform/

# Add all non-core modules (core builder already has the main app shell)
COPY modules/ ./modules/

RUN npm run build

# Stage 2: Serve with hardened nginx
FROM quay.io/osaipo-data/osaipo-pulse-frontend-runtime:${CORE_TAG}

COPY --from=build /app/dist /usr/share/nginx/html
