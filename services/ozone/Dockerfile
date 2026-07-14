FROM node:24.18-alpine3.23 AS build

RUN npm install -g pnpm@11.11.0

WORKDIR /app

COPY ./.npmrc ./
COPY ./.nvmrc ./
COPY ./package.json ./

# Move files into the image and install
COPY ./pnpm-lock.yaml ./
COPY ./pnpm-workspace.yaml ./
COPY ./tsconfig ./tsconfig
COPY ./lexicons ./lexicons
COPY ./packages/internal ./packages/internal
COPY ./packages/lex ./packages/lex

# NOTE ozones's transitive dependencies go here: if that changes, this needs to be updated.
# pnpm list --filter '@atproto/aws...' --filter '@atproto/ozone...' --depth 0 --json | jq '.[].path' | grep -v "/lex/" | grep -v "/internal/" | grep -v 'packages/ozone"' | sort -u | sed "s|\"$PWD/|./|; s|\"\$||"
COPY ./packages/api ./packages/api
COPY ./packages/aws ./packages/aws
COPY ./packages/bsky ./packages/bsky
COPY ./packages/common-web ./packages/common-web
COPY ./packages/common ./packages/common
COPY ./packages/crypto ./packages/crypto
COPY ./packages/did ./packages/did
COPY ./packages/identity ./packages/identity
COPY ./packages/lex-cli ./packages/lex-cli
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
COPY ./packages/pds ./packages/pds
COPY ./packages/repo ./packages/repo
COPY ./packages/sync ./packages/sync
COPY ./packages/syntax ./packages/syntax
COPY ./packages/ws-client ./packages/ws-client
COPY ./packages/xrpc-server ./packages/xrpc-server
COPY ./packages/xrpc ./packages/xrpc

COPY ./packages/ozone ./packages/ozone

# bsync is not a runtime dep but bsky's codegen:buf reads ../bsync/proto at build time
COPY ./packages/bsync ./packages/bsync

COPY ./services/ozone ./services/ozone

# install all deps
RUN PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile
# build all packages with external node_modules
RUN pnpm run --recursive --stream --filter '@atproto/aws...' --filter '@atproto/ozone...' build
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
