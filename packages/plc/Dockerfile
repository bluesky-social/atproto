FROM node:18-alpine as build

# Move files into the image and install
WORKDIR /app
COPY ./*.* ./
# NOTE plc's transitive dependencies go here: if that changes, this needs to be updated.
COPY ./packages/plc ./packages/plc
COPY ./packages/common ./packages/common
COPY ./packages/crypto ./packages/crypto
RUN ATP_BUILD_SHALLOW=true yarn install --frozen-lockfile > /dev/null
RUN yarn workspaces run build --update-main-to-dist > /dev/null
# Remove non-prod deps
RUN yarn install --production --ignore-scripts --prefer-offline > /dev/null

WORKDIR packages/plc/service
RUN yarn install --frozen-lockfile > /dev/null

# Uses assets from build stage to reduce build size
FROM node:18-alpine

# RUN npm install -g yarn
RUN apk add --update dumb-init

# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]

WORKDIR /app/packages/plc/service
COPY --from=build /app /app

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--enable-source-maps", "index.js"]

LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.description="DID Placeholder server"
LABEL org.opencontainers.image.licenses=MIT
