FROM node:18-alpine as build

# Move files into the image and install
WORKDIR /app
COPY ./*.* ./
# NOTE pds's transitive dependencies go here: if that changes, this needs to be updated.
COPY ./packages/pds ./packages/pds
COPY ./packages/api ./packages/api
COPY ./packages/aws ./packages/aws
COPY ./packages/common ./packages/common
COPY ./packages/crypto ./packages/crypto
COPY ./packages/did-resolver ./packages/did-resolver
COPY ./packages/handle ./packages/handle
COPY ./packages/lex-cli ./packages/lex-cli
COPY ./packages/lexicon ./packages/lexicon
COPY ./packages/nsid ./packages/nsid
COPY ./packages/pds ./packages/pds
COPY ./packages/plc ./packages/plc
COPY ./packages/repo ./packages/repo
COPY ./packages/uri ./packages/uri
COPY ./packages/xrpc ./packages/xrpc
COPY ./packages/xrpc-server ./packages/xrpc-server
RUN ATP_BUILD_SHALLOW=true yarn install --frozen-lockfile > /dev/null
RUN yarn workspaces run build --update-main-to-dist > /dev/null
# Remove non-prod deps
RUN yarn install --production --ignore-scripts --prefer-offline > /dev/null

WORKDIR packages/pds/service
RUN yarn install --frozen-lockfile > /dev/null

# Uses assets from build stage to reduce build size
FROM node:18-alpine

# RUN npm install -g yarn
RUN apk add --update dumb-init

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

WORKDIR /app/packages/pds/service
COPY --from=build /app /app

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--enable-source-maps", "index.js"]

LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.description="ATP Personal Data Server (PDS)"
LABEL org.opencontainers.image.licenses=MIT
