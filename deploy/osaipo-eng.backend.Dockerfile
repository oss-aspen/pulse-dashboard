# Org Pulse — Backend
#
# Extends the core backend image with specific modules.
# Core's default CMD (node server/dev-server.js) auto-discovers all
# modules in ./modules/, so no custom entrypoint is needed.

ARG CORE_TAG=latest
FROM quay.io/osaipo-data/org-pulse-core-backend:${CORE_TAG}

USER 0

# Install specific runtime dependencies not in core
RUN npm install --no-save @octokit/rest js-yaml express-rate-limit adm-zip xml2js

# Add all non-core modules (core image already has team-tracker)
COPY modules/ ./modules/

# Shadow core's team-tracker manifest to hide unused sidebar nav items
# (Reports, Org Dashboard). Views stay reachable by URL. Kept in sync with
# the pinned core version by deploy/__tests__/team-tracker-module.test.js.
COPY deploy/team-tracker-module.json ./modules/team-tracker/module.json

# Add all non-core fixtures (core image already has core fixtures)
COPY fixtures/ ./fixtures/

# Add platform customizations
COPY platform/ ./platform/

USER 65532
