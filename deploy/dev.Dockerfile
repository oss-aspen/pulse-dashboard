FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    NPM_CONFIG_CACHE=/tmp/.npm
WORKDIR /app
RUN chown node:0 /app && chmod g=u /app && chmod g+s /app

COPY deploy/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod 0755 /usr/local/bin/dev-entrypoint.sh

USER node

# Dependencies are installed into the image so the named volume mounted at
# /app/node_modules is seeded from it on first use (owned by node).
COPY --chown=node:0 package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts \
    && sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.lock-hash \
    && chmod -R g=u node_modules \
    && rm -rf "$NPM_CONFIG_CACHE"

ENTRYPOINT ["/usr/local/bin/dev-entrypoint.sh"]
CMD ["node", "--watch", "server/index.js"]
