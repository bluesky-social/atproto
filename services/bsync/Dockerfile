FROM node:18-alpine AS build

RUN corepack enable

WORKDIR /app

COPY ./package.json ./
RUN corepack prepare --activate

# Move files into the image and install
COPY ./*.* ./
COPY ./tsconfig ./tsconfig

# NOTE bsync's transitive dependencies go here: if that changes, this needs to be updated.
# pnpm list --filter '@atproto/bsync...' --depth 0 --json | jq '.[].path'
COPY ./packages/bsync ./packages/bsync
COPY ./packages/common ./packages/common
COPY ./packages/common-web ./packages/common-web
COPY ./packages/lex/lex-cbor ./packages/lex/lex-cbor
COPY ./packages/lex/lex-data ./packages/lex/lex-data
COPY ./packages/lex/lex-json ./packages/lex/lex-json
COPY ./packages/syntax ./packages/syntax

COPY ./services/bsync ./services/bsync

# install all deps
RUN pnpm install --frozen-lockfile
# build all packages with external node_modules
RUN pnpm run --recursive --stream --filter '@atproto/bsync...' build
# clean up
RUN rm -rf node_modules
# install only prod deps, hoisted to root node_modules dir
RUN pnpm install --prod --shamefully-hoist --frozen-lockfile --prefer-offline

WORKDIR services/bsync

# Uses assets from build stage to reduce build size
FROM node:18-alpine

RUN apk add --update dumb-init

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

WORKDIR /app/services/bsync
COPY --from=build /app /app

EXPOSE 3000
ENV BSYNC_PORT=3000
ENV NODE_ENV=production

# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--enable-source-maps", "index.js"]

LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.description="Bsync"
LABEL org.opencontainers.image.licenses=MIT
