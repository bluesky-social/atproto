FROM node:24.18-alpine3.23 AS build

RUN npm install -g pnpm@11.11.0

WORKDIR /app

COPY ./.npmrc ./
COPY ./.nvmrc ./
COPY ./package.json ./
COPY ./pnpm-lock.yaml ./
COPY ./pnpm-workspace.yaml ./
COPY ./tsconfig ./tsconfig
COPY ./lexicons ./lexicons

# bsync is not a runtime dep but bsky's "codegen:buf" script reads ../bsync/proto at build time
COPY ./packages/bsync/proto ./packages/bsync/proto

# NOTE ozones's transitive dependencies go here: if that changes, this needs to be updated.
# pnpm list --filter 'ozone-service...' --depth 0 --json | jq '.[].path' | sort -u | sed "s|\"$PWD/|./|; s|\"\$||"
COPY ./packages/api ./packages/api
COPY ./packages/aws ./packages/aws
COPY ./packages/common-web ./packages/common-web
COPY ./packages/common ./packages/common
COPY ./packages/crypto ./packages/crypto
COPY ./packages/did ./packages/did
COPY ./packages/identity ./packages/identity
COPY ./packages/internal/did-resolver ./packages/internal/did-resolver
COPY ./packages/internal/fetch-node ./packages/internal/fetch-node
COPY ./packages/internal/fetch ./packages/internal/fetch
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
COPY ./packages/lex/lex-schema ./packages/lex/lex-schema
COPY ./packages/lex/lex ./packages/lex/lex
COPY ./packages/lexicon ./packages/lexicon
COPY ./packages/oauth/jwk-jose ./packages/oauth/jwk-jose
COPY ./packages/oauth/jwk-webcrypto ./packages/oauth/jwk-webcrypto
COPY ./packages/oauth/jwk ./packages/oauth/jwk
COPY ./packages/oauth/oauth-client-browser-example ./packages/oauth/oauth-client-browser-example
COPY ./packages/oauth/oauth-client-browser ./packages/oauth/oauth-client-browser
COPY ./packages/oauth/oauth-client ./packages/oauth/oauth-client
COPY ./packages/oauth/oauth-provider-api ./packages/oauth/oauth-provider-api
COPY ./packages/oauth/oauth-provider-ui ./packages/oauth/oauth-provider-ui
COPY ./packages/oauth/oauth-provider ./packages/oauth/oauth-provider
COPY ./packages/oauth/oauth-scopes ./packages/oauth/oauth-scopes
COPY ./packages/oauth/oauth-types ./packages/oauth/oauth-types
COPY ./packages/ozone ./packages/ozone
COPY ./packages/pds ./packages/pds
COPY ./packages/repo ./packages/repo
COPY ./packages/syntax ./packages/syntax
COPY ./packages/ws-client ./packages/ws-client
COPY ./packages/xrpc-server ./packages/xrpc-server
COPY ./packages/xrpc ./packages/xrpc
COPY ./services/ozone ./services/ozone

# install all deps
RUN PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile
# build all the dependencies of ./package.json
RUN pnpm run --recursive --stream --workspace-concurrency 1 --filter 'ozone-service...' build -- --force
# install only prod deps, hoisted to root node_modules dir
RUN pnpm install --prod --shamefully-hoist --frozen-lockfile --prefer-offline --config.confirmModulesPurge=false

# Uses assets from build stage to reduce build size
FROM node:24.18-alpine3.23

RUN apk add --update dumb-init

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

COPY --from=build /app /app
WORKDIR /app/services/ozone

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--enable-source-maps", "--import=./tracer.ts", "api.ts"]

LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.description="Ozone"
LABEL org.opencontainers.image.licenses=MIT
