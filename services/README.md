# Services

Thin runtime wrappers around `packages/{bsky,bsync,ozone,pds}`, built into Docker images from the root [Dockerfile](../Dockerfile), with one target per service.

To develop against a working stack seeded with test accounts, use `pnpm dev` instead (see [CONTRIBUTING.md](../CONTRIBUTING.md#developer-quickstart)). This page is for building and running the images themselves.

## Building

From the repository root, [docker-bake.hcl](../docker-bake.hcl) builds all four images and tags them `<service>:local`:

```bash
docker buildx bake
```

To build a single service:

```bash
docker buildx bake bsky
# or, equivalently
docker build --target bsky -t bsky:local .
```

## Running

The commands below start the four images together on a shared network, with a Postgres container for bsync and ozone. Secrets are random values generated for each run, and DIDs are placeholders.

```bash
docker network create atproto

docker run -d --name atproto-db --network atproto \
  -e POSTGRES_USER=pg -e POSTGRES_PASSWORD=password \
  postgres:14.4-alpine

docker run -d --name bsync --network atproto -p 2585:3000 \
  -e BSYNC_DB_POSTGRES_URL=postgres://pg:password@atproto-db/postgres \
  -e BSYNC_DB_POSTGRES_SCHEMA=bsync \
  -e BSYNC_DB_MIGRATE=true \
  -e BSYNC_API_KEYS=bsync-api-key \
  bsync:local

docker run -d --name bsky --network atproto -p 2584:3000 \
  -e BSKY_PORT=3000 \
  -e BSKY_PUBLIC_URL=http://localhost:2584 \
  -e BSKY_SERVICE_SIGNING_KEY="$(openssl rand -hex 32)" \
  -e BSKY_DATAPLANE_URLS=http://dataplane.invalid \
  -e BSKY_BSYNC_URL=http://bsync:3000 \
  -e BSKY_BSYNC_API_KEY=bsync-api-key \
  -e MOD_SERVICE_DID=did:web:ozone \
  -e DD_TRACE_ENABLED=false \
  bsky:local

docker run -d --name ozone --network atproto -p 2587:3000 \
  -e OZONE_PUBLIC_URL=http://localhost:2587 \
  -e OZONE_SERVER_DID=did:web:ozone \
  -e OZONE_DB_POSTGRES_URL=postgres://pg:password@atproto-db/postgres \
  -e OZONE_DB_POSTGRES_SCHEMA=ozone \
  -e OZONE_DB_MIGRATE=1 \
  -e OZONE_APPVIEW_URL=http://bsky:3000 \
  -e OZONE_APPVIEW_DID=did:web:bsky \
  -e OZONE_DID_PLC_URL=https://plc.directory \
  -e OZONE_ADMIN_PASSWORD=admin-password \
  -e OZONE_SIGNING_KEY_HEX="$(openssl rand -hex 32)" \
  -e DD_TRACE_ENABLED=false \
  ozone:local

docker run -d --name pds --network atproto -p 2583:2583 \
  -e PDS_PORT=2583 \
  -e PDS_DEV_MODE=true \
  -e PDS_DATA_DIRECTORY=/app/data \
  -e PDS_BLOBSTORE_DISK_LOCATION=/app/data/blobs \
  -e PDS_JWT_SECRET="$(openssl rand -hex 16)" \
  -e PDS_ADMIN_PASSWORD=admin-password \
  -e PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX="$(openssl rand -hex 32)" \
  -e PDS_BSKY_APP_VIEW_URL=http://bsky:3000 \
  -e PDS_BSKY_APP_VIEW_DID=did:web:bsky \
  -e PDS_REPORT_SERVICE_URL=http://ozone:3000 \
  -e PDS_REPORT_SERVICE_DID=did:web:ozone \
  pds:local
```

Each service then answers on its health endpoint: bsync on `http://localhost:2585/_health`, and the others on `/xrpc/_health` at ports 2584 (bsky), 2587 (ozone) and 2583 (pds). bsky's health check pings its dataplane, so it reports `503` here, and so does every endpoint that reads data: no dataplane image is built from this repository.

Notes:

- bsky listens on `BSKY_PORT` (2584 by default), not on the image's `PORT`.
- The PDS derives its public URL from its port when `PDS_HOSTNAME` is unset (`http://localhost:<PDS_PORT>`), and only accepts a non-https public URL in dev mode. Keep the container and host ports the same.
- `DD_TRACE_ENABLED=false` turns off the Datadog tracer loaded by the bsky and ozone images.

To stop and remove everything:

```bash
docker rm -f pds ozone bsky bsync atproto-db
docker network rm atproto
```
