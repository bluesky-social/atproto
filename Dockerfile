# syntax=docker/dockerfile:1

# Service images: docker buildx bake <bsky|bsync|ozone|pds>
# All of them, tagged <service>:local: docker buildx bake (see services/README.md)
#
# Each service builds from the workspace projects it depends on only, so that
# changes elsewhere in the repository keep its image cached.
#
# Image labels are set by the docker-images workflow. EXPOSE and VOLUME
# only matter when running an image locally.

FROM node:24.22.2-alpine3.24 AS base
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

# @NOTE The <service>-source stages run on every change, but `COPY --from` only
# invalidates a build stage when the files it copies changed.
FROM base AS source
# Copies the repository root, without its workspace projects, and the workspace
# projects <project> depends on (devDependencies included) to /out. Run with the
# repository bind mounted on /app: copying it would add a layer that changes,
# and gets exported to the build cache, on every change.
COPY --chmod=755 <<'EOF' /usr/local/bin/select-sources
#!/bin/sh
set -eu
mkdir /out
tar -cf - --exclude=./packages --exclude=./services . \
  | tar -xf - -C /out
pnpm list --recursive --depth -1 --parseable --filter "$1..." \
  | sed -n 's|^/app/||p' \
  | tar -cf - -T - \
  | tar -xf - -C /out
EOF

FROM source AS bsky-source
RUN --mount=type=bind,target=/app select-sources bsky-app-view-service

FROM source AS bsync-source
RUN --mount=type=bind,target=/app select-sources bsync-service

FROM source AS ozone-source
RUN --mount=type=bind,target=/app select-sources ozone-service

FROM source AS pds-source
RUN --mount=type=bind,target=/app select-sources pds-service

# @NOTE The build stages follow the root `pnpm build` (prebuild, build:ts,
# postbuild), scoped to the service's production dependencies, with build:ts
# replaced by a `tsc --build` of the service's tsconfig.json (which references
# its packages), as only the projects the service depends on are copied. Never
# `pnpm run --recursive build` concurrently: each package's `tsc --build` also
# rebuilds its references, rewriting files that other builds are reading.
# `pnpm deploy` copies each service's `files`, and also writes a pnpm-lock.yaml
# and pnpm-workspace.yaml that only pnpm reads: these are removed.

FROM deps AS bsky-build
COPY --from=bsky-source /out/ ./
RUN pnpm install --offline --frozen-lockfile
RUN pnpm run build:tooling \
 && pnpm run --parallel --workspace-concurrency Infinity --filter-prod 'bsky-app-view-service...' prebuild \
 && pnpm exec tsc --build services/bsky/tsconfig.json \
 && pnpm --filter bsky-app-view-service --prod deploy /deploy \
 && rm /deploy/pnpm-lock.yaml /deploy/pnpm-workspace.yaml

FROM deps AS bsync-build
COPY --from=bsync-source /out/ ./
RUN pnpm install --offline --frozen-lockfile
# bsync does not use the codegen tooling
RUN pnpm run --parallel --workspace-concurrency Infinity --filter-prod 'bsync-service...' prebuild \
 && pnpm exec tsc --build services/bsync/tsconfig.json \
 && pnpm --filter bsync-service --prod deploy /deploy \
 && rm /deploy/pnpm-lock.yaml /deploy/pnpm-workspace.yaml

FROM deps AS ozone-build
COPY --from=ozone-source /out/ ./
RUN pnpm install --offline --frozen-lockfile
RUN pnpm run build:tooling \
 && pnpm run --parallel --workspace-concurrency Infinity --filter-prod 'ozone-service...' prebuild \
 && pnpm exec tsc --build services/ozone/tsconfig.json \
 && pnpm --filter ozone-service --prod deploy /deploy \
 && rm /deploy/pnpm-lock.yaml /deploy/pnpm-workspace.yaml

FROM deps AS pds-build
COPY --from=pds-source /out/ ./
RUN pnpm install --offline --frozen-lockfile
RUN pnpm run build:tooling \
 && pnpm run --parallel --workspace-concurrency Infinity --filter-prod 'pds-service...' prebuild \
 && pnpm exec tsc --build services/pds/tsconfig.json \
 && pnpm run --parallel --filter-prod 'pds-service...' build:ui \
 && pnpm --filter pds-service --prod deploy /deploy \
 && rm /deploy/pnpm-lock.yaml /deploy/pnpm-workspace.yaml

FROM node:24.22.2-alpine3.24 AS runtime
RUN apk add --no-cache dumb-init
# Avoid zombie processes, handle signal forwarding
ENTRYPOINT ["dumb-init", "--"]
ENV NODE_ENV=production

FROM runtime AS bsky
# (optionally) used for logging via svlogd.
RUN apk add --no-cache runit
WORKDIR /app/services/bsky
COPY --from=bsky-build /deploy /app/services/bsky
EXPOSE 3000
ENV PORT=3000
USER node
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=./tracer.ts", "--import=@atproto/bsky/telemetry", "api.ts"]

FROM runtime AS bsync
WORKDIR /app/services/bsync
COPY --from=bsync-build /deploy /app/services/bsync
EXPOSE 3000
ENV BSYNC_PORT=3000
USER node
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=@atproto/bsync/telemetry", "index.ts"]

FROM runtime AS ozone
WORKDIR /app/services/ozone
COPY --from=ozone-build /deploy /app/services/ozone
EXPOSE 3000
# Metrics + ops-probe (/metrics, /livez, /readyz) server port. Opt-in and off by
# default: api.ts uses OZONE_METRICS_PORT, daemon.ts uses OZONE_DAEMON_METRICS_PORT.
# Documented here for reference; not enabled unless the env var is set.
EXPOSE 3001
ENV PORT=3000
ENV OTEL_TRACES_SAMPLER=parentbased_traceidratio
ENV OTEL_TRACES_SAMPLER_ARG=0.01
USER node
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=./tracer.ts", "api.ts"]

FROM runtime AS pds
LABEL social.bsky.pds.telemetry="otel"
WORKDIR /app/services/pds
COPY --from=pds-build /deploy /app/services/pds
RUN mkdir /app/data && chown node /app/data
VOLUME /app/data
EXPOSE 3000
ENV PDS_PORT=3000
# potential perf issues w/ io_uring on this version of node
ENV UV_USE_IO_URING=0
USER node
CMD ["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=@atproto/pds/telemetry", "index.ts"]
