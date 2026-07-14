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

# NOTE bsync's transitive dependencies go here: if that changes, this needs to be updated.
# pnpm list --filter '@atproto/bsync...' --depth 0 --json | jq '.[].path' | grep -v 'packages/bsync"' | sort -u | sed "s|\"$PWD/|./|; s|\"\$||"
COPY ./packages/common-web ./packages/common-web
COPY ./packages/common ./packages/common
COPY ./packages/lex/lex-cbor ./packages/lex/lex-cbor
COPY ./packages/lex/lex-data ./packages/lex/lex-data
COPY ./packages/lex/lex-json ./packages/lex/lex-json
COPY ./packages/syntax ./packages/syntax

COPY ./services/bsync ./services/bsync

# install all deps
RUN PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile
# build all packages with external node_modules
RUN pnpm run --recursive --stream --filter '@atproto/bsync...' build
# install only prod deps, hoisted to root node_modules dir
RUN pnpm install --prod --shamefully-hoist --frozen-lockfile --prefer-offline --config.confirmModulesPurge=false

# Uses assets from build stage to reduce build size
FROM node:24.18-alpine3.23

RUN apk add --update dumb-init

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

COPY --from=build /app /app
WORKDIR /app/services/bsync

EXPOSE 3000
ENV BSYNC_PORT=3000
ENV NODE_ENV=production

# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--enable-source-maps", "--import=./tracer.ts", "index.ts"]

LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.description="Bsync"
LABEL org.opencontainers.image.licenses=MIT
