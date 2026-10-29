FROM node:24.22-alpine3.23 AS build

RUN npm install -g pnpm@11.11.0

WORKDIR /app

COPY ./.npmrc ./
COPY ./.nvmrc ./
COPY ./package.json ./
COPY ./pnpm-lock.yaml ./
COPY ./pnpm-workspace.yaml ./

# @NOTE Keep manifest and source COPY lists in sync with bsky's transitive dependencies.
# pnpm list --filter 'bsky-app-view-service...' --depth 0 --json | jq '.[].path' | sort -u | sed "s|\"$PWD/|./|; s|\"\$||"
COPY ./packages/api/package.json ./packages/api/
COPY ./packages/aws/package.json ./packages/aws/
COPY ./packages/bsky/package.json ./packages/bsky/
COPY ./packages/common-web/package.json ./packages/common-web/
COPY ./packages/common/package.json ./packages/common/
COPY ./packages/crypto/package.json ./packages/crypto/
COPY ./packages/did/package.json ./packages/did/
COPY ./packages/identity/package.json ./packages/identity/
COPY ./packages/internal/did-resolver/package.json ./packages/internal/did-resolver/
COPY ./packages/internal/fetch-node/package.json ./packages/internal/fetch-node/
COPY ./packages/internal/fetch/package.json ./packages/internal/fetch/
COPY ./packages/internal/handle-resolver-node/package.json ./packages/internal/handle-resolver-node/
COPY ./packages/internal/handle-resolver/package.json ./packages/internal/handle-resolver/
COPY ./packages/internal/identity-resolver/package.json ./packages/internal/identity-resolver/
COPY ./packages/internal/opentelemetry-node/package.json ./packages/internal/opentelemetry-node/
COPY ./packages/internal/pipe/package.json ./packages/internal/pipe/
COPY ./packages/internal/rolldown-plugin-bundle-manifest/package.json ./packages/internal/rolldown-plugin-bundle-manifest/
COPY ./packages/internal/simple-store-memory/package.json ./packages/internal/simple-store-memory/
COPY ./packages/internal/simple-store-redis/package.json ./packages/internal/simple-store-redis/
COPY ./packages/internal/simple-store/package.json ./packages/internal/simple-store/
COPY ./packages/internal/xrpc-utils/package.json ./packages/internal/xrpc-utils/
COPY ./packages/lex-cli/package.json ./packages/lex-cli/bin.js ./packages/lex-cli/
COPY ./packages/lex/lex-builder/package.json ./packages/lex/lex-builder/
COPY ./packages/lex/lex-cbor/package.json ./packages/lex/lex-cbor/
COPY ./packages/lex/lex-client/package.json ./packages/lex/lex-client/
COPY ./packages/lex/lex-data/package.json ./packages/lex/lex-data/
COPY ./packages/lex/lex-document/package.json ./packages/lex/lex-document/
COPY ./packages/lex/lex-installer/package.json ./packages/lex/lex-installer/
COPY ./packages/lex/lex-json/package.json ./packages/lex/lex-json/
COPY ./packages/lex/lex-resolver/package.json ./packages/lex/lex-resolver/
COPY ./packages/lex/lex-rpc/package.json ./packages/lex/lex-rpc/
COPY ./packages/lex/lex-schema/package.json ./packages/lex/lex-schema/
COPY ./packages/lex/lex/package.json ./packages/lex/lex/
COPY ./packages/lexicon/package.json ./packages/lexicon/
COPY ./packages/oauth/jwk-jose/package.json ./packages/oauth/jwk-jose/
COPY ./packages/oauth/jwk-webcrypto/package.json ./packages/oauth/jwk-webcrypto/
COPY ./packages/oauth/jwk/package.json ./packages/oauth/jwk/
COPY ./packages/oauth/oauth-client-browser-example/package.json ./packages/oauth/oauth-client-browser-example/bin.js ./packages/oauth/oauth-client-browser-example/
COPY ./packages/oauth/oauth-client-browser/package.json ./packages/oauth/oauth-client-browser/
COPY ./packages/oauth/oauth-client-node/package.json ./packages/oauth/oauth-client-node/
COPY ./packages/oauth/oauth-client/package.json ./packages/oauth/oauth-client/
COPY ./packages/oauth/oauth-provider-api/package.json ./packages/oauth/oauth-provider-api/
COPY ./packages/oauth/oauth-provider-ui/package.json ./packages/oauth/oauth-provider-ui/
COPY ./packages/oauth/oauth-provider/package.json ./packages/oauth/oauth-provider/
COPY ./packages/oauth/oauth-resolver/package.json ./packages/oauth/oauth-resolver/
COPY ./packages/oauth/oauth-scopes/package.json ./packages/oauth/oauth-scopes/
COPY ./packages/oauth/oauth-types/package.json ./packages/oauth/oauth-types/
COPY ./packages/pds/package.json ./packages/pds/
COPY ./packages/repo/package.json ./packages/repo/
COPY ./packages/sync/package.json ./packages/sync/
COPY ./packages/syntax/package.json ./packages/syntax/
COPY ./packages/ws-client/package.json ./packages/ws-client/
COPY ./packages/xrpc-server/package.json ./packages/xrpc-server/
COPY ./packages/xrpc/package.json ./packages/xrpc/
COPY ./services/bsky/package.json ./services/bsky/

# @NOTE Workspace bin targets must exist when pnpm creates command shims.
COPY ./packages/lex/lex-builder/bin ./packages/lex/lex-builder/bin
COPY ./packages/lex/lex-installer/bin ./packages/lex/lex-installer/bin
COPY ./packages/lex/lex/bin ./packages/lex/lex/bin

# @NOTE Source-only changes must not invalidate dependency installation.
RUN PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile

COPY ./tsconfig ./tsconfig
COPY ./lexicons ./lexicons
COPY ./lexicons-overrides ./lexicons-overrides

# bsync is not a runtime dep but bsky's "codegen:buf" script reads ../bsync/proto at build time
COPY ./packages/bsync/proto ./packages/bsync/proto

COPY ./packages/api ./packages/api
COPY ./packages/aws ./packages/aws
COPY ./packages/bsky ./packages/bsky
COPY ./packages/common-web ./packages/common-web
COPY ./packages/common ./packages/common
COPY ./packages/crypto ./packages/crypto
COPY ./packages/did ./packages/did
COPY ./packages/identity ./packages/identity
COPY ./packages/internal/did-resolver ./packages/internal/did-resolver
COPY ./packages/internal/fetch-node ./packages/internal/fetch-node
COPY ./packages/internal/fetch ./packages/internal/fetch
COPY ./packages/internal/handle-resolver-node ./packages/internal/handle-resolver-node
COPY ./packages/internal/handle-resolver ./packages/internal/handle-resolver
COPY ./packages/internal/identity-resolver ./packages/internal/identity-resolver
COPY ./packages/internal/opentelemetry-node ./packages/internal/opentelemetry-node
COPY ./packages/internal/pipe ./packages/internal/pipe
COPY ./packages/internal/rolldown-plugin-bundle-manifest ./packages/internal/rolldown-plugin-bundle-manifest
COPY ./packages/internal/simple-store-memory ./packages/internal/simple-store-memory
COPY ./packages/internal/simple-store-redis ./packages/internal/simple-store-redis
COPY ./packages/internal/simple-store ./packages/internal/simple-store
COPY ./packages/internal/xrpc-utils ./packages/internal/xrpc-utils
COPY ./packages/lex-cli ./packages/lex-cli
COPY ./packages/lex/lex-builder ./packages/lex/lex-builder
COPY ./packages/lex/lex-cbor ./packages/lex/lex-cbor
COPY ./packages/lex/lex-client ./packages/lex/lex-client
COPY ./packages/lex/lex-data ./packages/lex/lex-data
COPY ./packages/lex/lex-document ./packages/lex/lex-document
COPY ./packages/lex/lex-installer ./packages/lex/lex-installer
COPY ./packages/lex/lex-json ./packages/lex/lex-json
COPY ./packages/lex/lex-resolver ./packages/lex/lex-resolver
COPY ./packages/lex/lex-rpc ./packages/lex/lex-rpc
COPY ./packages/lex/lex-schema ./packages/lex/lex-schema
COPY ./packages/lex/lex ./packages/lex/lex
COPY ./packages/lexicon ./packages/lexicon
COPY ./packages/oauth/jwk-jose ./packages/oauth/jwk-jose
COPY ./packages/oauth/jwk-webcrypto ./packages/oauth/jwk-webcrypto
COPY ./packages/oauth/jwk ./packages/oauth/jwk
COPY ./packages/oauth/oauth-client-browser-example ./packages/oauth/oauth-client-browser-example
COPY ./packages/oauth/oauth-client-browser ./packages/oauth/oauth-client-browser
COPY ./packages/oauth/oauth-client-node ./packages/oauth/oauth-client-node
COPY ./packages/oauth/oauth-client ./packages/oauth/oauth-client
COPY ./packages/oauth/oauth-provider-api ./packages/oauth/oauth-provider-api
COPY ./packages/oauth/oauth-provider-ui ./packages/oauth/oauth-provider-ui
COPY ./packages/oauth/oauth-provider ./packages/oauth/oauth-provider
COPY ./packages/oauth/oauth-resolver ./packages/oauth/oauth-resolver
COPY ./packages/oauth/oauth-scopes ./packages/oauth/oauth-scopes
COPY ./packages/oauth/oauth-types ./packages/oauth/oauth-types
COPY ./packages/pds ./packages/pds
COPY ./packages/repo ./packages/repo
COPY ./packages/sync ./packages/sync
COPY ./packages/syntax ./packages/syntax
COPY ./packages/ws-client ./packages/ws-client
COPY ./packages/xrpc-server ./packages/xrpc-server
COPY ./packages/xrpc ./packages/xrpc
COPY ./services/bsky ./services/bsky

# @NOTE Build codegen tools before filtering out development dependencies.
RUN pnpm run --recursive --stream --workspace-concurrency 1 --filter '@atproto/lex-installer...' --filter '@atproto/lex-cli...' build \
 && pnpm run --recursive --stream --workspace-concurrency 1 --filter-prod 'bsky-app-view-service...' build
# install only prod deps, hoisted to root node_modules dir
RUN pnpm install --prod --shamefully-hoist --frozen-lockfile --prefer-offline --config.confirmModulesPurge=false

# Uses assets from build stage to reduce build size
FROM node:24.22-alpine3.23

# dumb-init is used to handle signals properly.
# runit is installed so it can be (optionally) used for logging via svlogd.
RUN apk add --update dumb-init runit

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

COPY --from=build /app /app
COPY ./packages/internal/fetch-node/src/emudhra-preload.mjs /app/emudhra-preload.mjs
WORKDIR /app/services/bsky

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
# Load before tracing, including when the default command is overridden.
ENV NODE_OPTIONS="--import=/app/emudhra-preload.mjs"

# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=./tracer.ts", "--import=@atproto/bsky/telemetry", "api.ts"]

LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.description="Bsky App View"
LABEL org.opencontainers.image.licenses=MIT
