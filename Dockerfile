# syntax=docker/dockerfile:1

# Service images: docker build --target <bsky|bsync|ozone|pds> .
#
# Only the dependency download is cached across source changes. Every other
# change re-runs the (offline) install and the builds.

FROM node:24.22-alpine3.23 AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app
# Installs the pnpm version pinned by package.json#packageManager
COPY package.json ./
RUN corepack enable && corepack install

# @NOTE Lockfile-level inputs only, so manifest and source changes keep the
# dependency download cached.
FROM base AS deps
COPY .npmrc pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

FROM deps AS workspace
COPY . .
RUN pnpm install --offline --frozen-lockfile
# Codegen tools and the OAuth UI's bundler plugin are dev dependencies, which
# the --filter-prod service builds below do not select.
RUN pnpm run build:tooling

# @NOTE `pnpm deploy` writes the service and its production dependencies, from
# the lockfile, to a self-contained /deploy. It is not run --offline: it needs
# registry metadata for the pruned lockfile.
FROM workspace AS bsky-build
RUN pnpm run --recursive --stream --workspace-concurrency 1 --filter-prod 'bsky-app-view-service...' build \
 && pnpm --filter bsky-app-view-service --prod deploy /deploy

FROM workspace AS bsync-build
RUN pnpm run --recursive --stream --workspace-concurrency 1 --filter-prod 'bsync-service...' build \
 && pnpm --filter bsync-service --prod deploy /deploy

FROM workspace AS ozone-build
RUN pnpm run --recursive --stream --workspace-concurrency 1 --filter-prod 'ozone-service...' build \
 && pnpm --filter ozone-service --prod deploy /deploy

FROM workspace AS pds-build
RUN pnpm run --recursive --stream --workspace-concurrency 1 --filter-prod 'pds-service...' build \
 && pnpm --filter pds-service --prod deploy /deploy

FROM node:24.22-alpine3.23 AS runtime
RUN apk add --update dumb-init
# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]
COPY ./packages/internal/fetch-node/src/emudhra-preload.mjs /app/emudhra-preload.mjs
ENV NODE_ENV=production
# Load before tracing, including when the default command is overridden.
ENV NODE_OPTIONS="--import=/app/emudhra-preload.mjs"
LABEL org.opencontainers.image.source=https://github.com/bluesky-social/atproto
LABEL org.opencontainers.image.licenses=MIT
# Allows consumer to distinguish (old) pre-otel builds
LABEL social.bsky.pds.telemetry="otel"

FROM runtime AS bsky
# runit is installed so it can be (optionally) used for logging via svlogd.
RUN apk add --update runit
COPY --from=bsky-build /deploy /app/services/bsky
WORKDIR /app/services/bsky
EXPOSE 3000
ENV PORT=3000
# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=./tracer.ts", "--import=@atproto/bsky/telemetry", "api.ts"]
LABEL org.opencontainers.image.description="Bsky App View"

FROM runtime AS bsync
COPY --from=bsync-build /deploy /app/services/bsync
WORKDIR /app/services/bsync
EXPOSE 3000
ENV BSYNC_PORT=3000
USER node
CMD ["node", "--enable-source-maps", "--import=@atproto/bsync/telemetry", "index.ts"]
LABEL org.opencontainers.image.description="Bsync"

FROM runtime AS ozone
COPY --from=ozone-build /deploy /app/services/ozone
WORKDIR /app/services/ozone
EXPOSE 3000
# Metrics + ops-probe (/metrics, /livez, /readyz) server port. Opt-in and off by
# default: api.ts uses OZONE_METRICS_PORT, daemon.ts uses OZONE_DAEMON_METRICS_PORT.
# Documented here for reference; not enabled unless the env var is set.
EXPOSE 3001
ENV PORT=3000
ENV OTEL_TRACES_SAMPLER=parentbased_traceidratio
ENV OTEL_TRACES_SAMPLER_ARG=0.01
USER node
CMD ["node", "--enable-source-maps", "--import=./tracer.ts", "api.ts"]
LABEL org.opencontainers.image.description="Ozone"

FROM runtime AS pds
COPY --from=pds-build /deploy /app/services/pds
WORKDIR /app/services/pds
RUN mkdir /app/data && chown node /app/data
VOLUME /app/data
EXPOSE 3000
ENV PDS_PORT=3000
# potential perf issues w/ io_uring on this version of node
ENV UV_USE_IO_URING=0
USER node
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=@atproto/pds/telemetry", "index.ts"]
LABEL org.opencontainers.image.description="ATP Personal Data Server (PDS)"
