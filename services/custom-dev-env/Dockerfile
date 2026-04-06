# PDS + PLC dev environment - lightweight alternative to dev container
# Runs only PDS and PLC servers (no appview, ozone, etc.) using SQLite + in-memory stores.
# No Postgres or Redis required.

FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

WORKDIR /app

# Copy workspace config and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy tsconfig
COPY tsconfig tsconfig/
COPY tsconfig.json ./

# Copy lexicons and packages needed for dev-env + PDS
COPY lexicons ./lexicons
COPY packages/internal ./packages/internal
COPY packages/lex ./packages/lex
COPY packages/api ./packages/api
COPY packages/aws ./packages/aws
COPY packages/common ./packages/common
COPY packages/common-web ./packages/common-web
COPY packages/crypto ./packages/crypto
COPY packages/did ./packages/did
COPY packages/identity ./packages/identity
COPY packages/lex-cli ./packages/lex-cli
COPY packages/lexicon ./packages/lexicon
COPY packages/lexicon-resolver ./packages/lexicon-resolver
COPY packages/repo ./packages/repo
COPY packages/sync ./packages/sync
COPY packages/syntax ./packages/syntax
COPY packages/xrpc ./packages/xrpc
COPY packages/xrpc-server ./packages/xrpc-server
COPY packages/ws-client ./packages/ws-client
COPY packages/pds ./packages/pds
COPY packages/oauth/jwk ./packages/oauth/jwk
COPY packages/oauth/jwk-jose ./packages/oauth/jwk-jose
COPY packages/oauth/jwk-webcrypto ./packages/oauth/jwk-webcrypto
COPY packages/oauth/oauth-client ./packages/oauth/oauth-client
COPY packages/oauth/oauth-client-browser ./packages/oauth/oauth-client-browser
COPY packages/oauth/oauth-client-browser-example ./packages/oauth/oauth-client-browser-example
COPY packages/oauth/oauth-provider ./packages/oauth/oauth-provider
COPY packages/oauth/oauth-provider-api ./packages/oauth/oauth-provider-api
COPY packages/oauth/oauth-provider-frontend ./packages/oauth/oauth-provider-frontend
COPY packages/oauth/oauth-provider-ui ./packages/oauth/oauth-provider-ui
COPY packages/oauth/oauth-scopes ./packages/oauth/oauth-scopes
COPY packages/oauth/oauth-types ./packages/oauth/oauth-types
COPY packages/bsky ./packages/bsky
COPY packages/bsync ./packages/bsync
COPY packages/ozone ./packages/ozone
COPY packages/dev-env ./packages/dev-env

# Service wrapper
COPY services/custom-dev-env ./services/custom-dev-env

# Install and build
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN cd packages/dev-env && pnpm run build-custom

# Runtime stage - minimal image
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts and node_modules from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/lexicons ./lexicons
COPY --from=build /app/services/custom-dev-env ./services/custom-dev-env
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/pnpm-lock.yaml ./

# PDS on 3000, PLC on 3001
EXPOSE 3000 3001

ENV NODE_ENV=development
ENV PDS_PORT=3000
ENV PLC_PORT=3001
ENV PDS_HOSTNAME=localhost
ENV PDS_DID_PLC_URL=http://127.0.0.1:3001

# Run via service wrapper (which runs packages/dev-env/dist/custom/run-pds-plc.js)
CMD ["node", "--enable-source-maps", "services/custom-dev-env/index.js"]
