FROM node:24.22-alpine3.23 AS build

RUN npm install -g pnpm@11.11.0

WORKDIR /app

COPY ./.npmrc ./
COPY ./.nvmrc ./
COPY ./package.json ./
COPY ./pnpm-lock.yaml ./
COPY ./pnpm-workspace.yaml ./

# @NOTE Keep manifest and source COPY lists in sync with bsync's transitive dependencies.
# pnpm list --filter 'bsync-service...' --depth 0 --json | jq '.[].path' | sort -u | sed "s|\"$PWD/|./|; s|\"\$||"
COPY ./packages/bsync/package.json ./packages/bsync/
COPY ./packages/common-web/package.json ./packages/common-web/
COPY ./packages/common/package.json ./packages/common/
COPY ./packages/internal/opentelemetry-node/package.json ./packages/internal/opentelemetry-node/
COPY ./packages/lex/lex-cbor/package.json ./packages/lex/lex-cbor/
COPY ./packages/lex/lex-data/package.json ./packages/lex/lex-data/
COPY ./packages/lex/lex-json/package.json ./packages/lex/lex-json/
COPY ./packages/syntax/package.json ./packages/syntax/
COPY ./services/bsync/package.json ./services/bsync/

# @NOTE Source-only changes must not invalidate dependency installation.
RUN PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile

COPY ./tsconfig ./tsconfig
COPY ./packages/bsync ./packages/bsync
COPY ./packages/common-web ./packages/common-web
COPY ./packages/common ./packages/common
COPY ./packages/internal/opentelemetry-node ./packages/internal/opentelemetry-node
COPY ./packages/lex/lex-cbor ./packages/lex/lex-cbor
COPY ./packages/lex/lex-data ./packages/lex/lex-data
COPY ./packages/lex/lex-json ./packages/lex/lex-json
COPY ./packages/syntax ./packages/syntax
COPY ./services/bsync ./services/bsync

RUN pnpm run --recursive --stream --workspace-concurrency 1 --filter-prod 'bsync-service...' build
# install only prod deps, hoisted to root node_modules dir
RUN pnpm install --prod --shamefully-hoist --frozen-lockfile --prefer-offline --config.confirmModulesPurge=false

# Uses assets from build stage to reduce build size
FROM node:24.22-alpine3.23

RUN apk add --update dumb-init

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

COPY --from=build /app /app
COPY ./packages/internal/fetch-node/src/emudhra-preload.mjs /app/emudhra-preload.mjs
WORKDIR /app/services/bsync

EXPOSE 3000
ENV BSYNC_PORT=3000
ENV NODE_ENV=production
# Load before tracing, including when the default command is overridden.
ENV NODE_OPTIONS="--import=/app/emudhra-preload.mjs"

# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--enable-source-maps", "--import=@atproto/bsync/telemetry", "index.ts"]

LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.description="Bsync"
LABEL org.opencontainers.image.licenses=MIT
