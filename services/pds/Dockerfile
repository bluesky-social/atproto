# @NOTE just a temp fix: alpine3.19 breaks sharp install, see nodejs/docker-node#2009
# see additional reference to this image further down.
FROM node:20.11-alpine3.18 as build

RUN corepack enable

WORKDIR /app

COPY ./package.json ./
RUN corepack prepare --activate

# Move files into the image and install
COPY ./*.* ./
# NOTE pds's transitive dependencies go here: if that changes, this needs to be updated.
COPY ./tsconfig ./tsconfig
COPY ./packages/pds ./packages/pds
COPY ./packages/api ./packages/api
COPY ./packages/aws ./packages/aws
COPY ./packages/common ./packages/common
COPY ./packages/common-web ./packages/common-web
COPY ./packages/crypto ./packages/crypto
COPY ./packages/syntax ./packages/syntax
COPY ./packages/identity ./packages/identity
COPY ./packages/lex-cli ./packages/lex-cli
COPY ./packages/lexicon ./packages/lexicon
COPY ./packages/repo ./packages/repo
COPY ./packages/xrpc ./packages/xrpc
COPY ./packages/xrpc-server ./packages/xrpc-server
COPY ./packages/oauth/jwk ./packages/oauth/jwk
COPY ./packages/oauth/jwk-jose ./packages/oauth/jwk-jose
COPY ./packages/oauth/oauth-types ./packages/oauth/oauth-types
COPY ./packages/oauth/oauth-provider ./packages/oauth/oauth-provider
COPY ./packages/internal/pipe ./packages/internal/pipe
COPY ./packages/internal/fetch ./packages/internal/fetch
COPY ./packages/internal/fetch-node ./packages/internal/fetch-node
COPY ./packages/internal/simple-store ./packages/internal/simple-store
COPY ./packages/internal/simple-store-memory ./packages/internal/simple-store-memory
COPY ./packages/internal/rollup-plugin-bundle-manifest ./packages/internal/rollup-plugin-bundle-manifest
COPY ./packages/internal/xrpc-utils ./packages/internal/xrpc-utils
COPY ./services/pds ./services/pds

# install all deps
RUN pnpm install --frozen-lockfile > /dev/null
# build all packages with external node_modules
RUN pnpm build > /dev/null
# clean up
RUN rm -rf node_modules
# install only prod deps, hoisted to root node_modules dir
RUN pnpm install --prod --shamefully-hoist --frozen-lockfile --prefer-offline > /dev/null

WORKDIR services/pds

# Uses assets from build stage to reduce build size
FROM node:20.11-alpine3.18

RUN apk add --update dumb-init

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

WORKDIR /app/services/pds
COPY --from=build /app /app
RUN mkdir /app/data && chown node /app/data

VOLUME /app/data
EXPOSE 3000
ENV PDS_PORT=3000
ENV NODE_ENV=production
# potential perf issues w/ io_uring on this version of node
ENV UV_USE_IO_URING=0

# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--require=./tracer.js", "index.js"]

LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.description="ATP Personal Data Server (PDS)"
LABEL org.opencontainers.image.licenses=MIT
