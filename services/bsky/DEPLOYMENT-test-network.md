# Deploying a de-federated bsky AppView test network

This runbook describes how to stand up the bsky AppView (the reference Postgres data plane)
on a persistent VPS as a small, **de-federated** test network that indexes only **one or two
self-hosted PDSes** — no relay, no Ozone, no production AppView dependencies. It leans on the
production `plc.directory` for identity resolution and serves images with the AppView's own
built-in Sharp resizer.

It references existing code in this repo and includes a copy-pasteable bootstrap script for the
one piece that has no standalone entrypoint today (the data plane + ingester).

> Scope: this is a low-scale **reference** deployment. The Postgres data plane here is intended
> for correctness and experimentation, not production throughput.

---

## 1. Architecture

A working AppView is really **three logical processes** plus a small sync helper:

```
                 com.atproto.sync.subscribeRepos (websocket)
   ┌──────────┐   ───────────────────────────────►   ┌─────────────────────┐
   │ test PDS │                                       │  Ingester           │
   │  (#1)    │                                       │ (RepoSubscription)  │
   └──────────┘                                       └──────────┬──────────┘
   ┌──────────┐   ───────────────────────────────►              │ writes
   │ test PDS │                                                  ▼
   │  (#2)    │                                       ┌─────────────────────┐
   └──────────┘                                       │  Postgres           │
                                                      │  (bsky data plane)  │
        ▲                                             └──────────┬──────────┘
        │ getBlob (images)                  reads               │ reads
        │                          ┌─────────────────┐          │
        │                          │ Data plane      │◄─────────┘
        │                          │ (Connect-RPC)   │
        │                          └────────┬────────┘
        │                                   │ Connect-RPC
        │                          ┌────────▼────────┐      ┌──────────────┐
        └──────────────────────────│  API server     │◄────►│  MockBsync   │
            Sharp resizer fetches  │  (BskyAppView)  │      │ (same DB)    │
            blobs from source PDS  └────────┬────────┘      └──────────────┘
                                            │ app.bsky.* XRPC
                                            ▼
                                          clients
```

| Process | What it does | Entrypoint |
|---|---|---|
| **API server** | Serves `app.bsky.*` XRPC; stateless; calls the data plane | [`services/bsky/api.ts`](./api.ts) |
| **Data plane** | Connect-RPC over Postgres; the indexed read store | bootstrap below |
| **Ingester** (`RepoSubscription`) | Subscribes to one PDS firehose, indexes into Postgres | bootstrap below |
| **MockBsync** | Mutes / notif prefs / bookmarks / drafts, into the **same** DB | bootstrap below |

**Why MockBsync instead of the real `bsync` service?** The API server requires a bsync endpoint
(`BSKY_BSYNC_URL` is asserted in [`packages/bsky/src/config.ts`](../../packages/bsky/src/config.ts)),
but [`MockBsync`](../../packages/bsky/src/data-plane/bsync/index.ts) implements all the operations a
single AppView actually uses (mutes, notification priority, bookmarks, drafts, activity
subscriptions, age assurance) by writing straight into the same Postgres DB. Only the `scan*`
RPCs — used for cross-AppView synchronization — are unimplemented, and a de-federated test net
never needs them. This avoids running the separate `bsync` package and its own database.

**Why no relay?** The ingester subscribes to exactly one firehose `service`. Pointing it at a
PDS's own `com.atproto.sync.subscribeRepos` websocket (served by
[`packages/pds/src/api/com/atproto/sync/subscribeRepos.ts`](../../packages/pds/src/api/com/atproto/sync/subscribeRepos.ts))
de-federates the network. For two PDSes, run two ingester instances against the same DB.

---

## 2. Prerequisites

On the VPS:

- **Node ≥ 22**, **pnpm**, and a checkout of this repo built once:
  ```bash
  pnpm install
  pnpm codegen        # required after any lexicon change; safe to run anyway
  pnpm build --force
  ```
- **Postgres 14+**. The simplest option is the persistent `db` service from
  [`packages/dev-infra/docker-compose.yaml`](../../packages/dev-infra/docker-compose.yaml)
  (user `pg` / password `password`, port 5432, volume `atp_db`):
  ```bash
  cd packages/dev-infra && docker compose up -d db
  ```
  Use a managed Postgres in anything resembling real use.
- A **service signing key** (secp256k1) for the AppView. Generate one and keep the private key:
  ```bash
  node -e "import('@atproto/crypto').then(async (c) => {
    const k = await c.Secp256k1Keypair.create({ exportable: true })
    const priv = Buffer.from(await k.export()).toString('hex')
    console.log('BSKY_SERVICE_SIGNING_KEY (private, hex):', priv)
    console.log('did:key (public):', k.did())
  })"
  ```
- An **AppView DID** registered on `plc.directory` (or a `did:web` for the AppView host) whose
  DID document advertises a `BskyAppView` service endpoint pointing at the API server's public
  URL. See the registration pattern in
  [`packages/dev-env/src/bsky.ts`](../../packages/dev-env/src/bsky.ts) (lines ~32–52), which uses
  `@did-plc/lib`'s `Client.createDid` + `updateData` to add the `bsky_appview` service.

---

## 3. Identity / PLC

Use the **production directory**: set `BSKY_DID_PLC_URL=https://plc.directory` everywhere.

Your self-hosted test PDSes register their account `did:plc`s on the real directory — a normal
PDS operation (`PDS_DID_PLC_URL=https://plc.directory`). The AppView then resolves DIDs →
PDS endpoints and handles read-only against `plc.directory`. **No self-hosted PLC is required.**

(If you ever want a fully air-gapped network, switch PDS accounts to `did:web` and skip PLC
entirely — but that is not this setup.)

---

## 4. Run the test PDS(es)

Run one or two PDSes from this repo's PDS service ([`services/pds`](../pds)). The settings that
matter for this topology (see [`packages/pds/src/config/env.ts`](../../packages/pds/src/config/env.ts)):

- `PDS_DID_PLC_URL=https://plc.directory`
- `PDS_BSKY_APP_VIEW_URL` / `PDS_BSKY_APP_VIEW_DID` — your AppView's public URL and DID, so the
  PDS proxies `app.bsky.*` reads to your AppView.
- `PDS_CRAWLERS` — leave **unset/empty**. There is no relay to notify; the AppView pulls the
  firehose directly.

Each PDS exposes its firehose at `ws://<pds-host>` (path `com.atproto.sync.subscribeRepos`),
which the ingester connects to in the next step.

---

## 5. The ingest bootstrap (the missing entrypoint)

`services/bsky/api.ts` boots **only** the read API. The data plane + ingester + MockBsync are
wired together only inside the test harness
([`packages/dev-env/src/bsky.ts`](../../packages/dev-env/src/bsky.ts)). For a persistent
deployment, drop the following script onto the VPS (e.g. `dataplane.mjs`) and run it with Node.
It is modeled directly on that harness, but uses your persistent Postgres and fixed ports.

```js
// dataplane.mjs — runs the bsky data plane + ingester(s) + MockBsync against persistent Postgres.
// Run: node --enable-source-maps dataplane.mjs
import * as bsky from '@atproto/bsky'

const DB_URL = process.env.BSKY_DB_POSTGRES_URL          // e.g. postgres://pg:password@localhost:5432/bsky
const DB_SCHEMA = process.env.BSKY_DB_POSTGRES_SCHEMA    // optional
const PLC_URL = process.env.BSKY_DID_PLC_URL || 'https://plc.directory'
const DATAPLANE_PORT = Number(process.env.BSKY_DATAPLANE_PORT || 2510)
const BSYNC_PORT = Number(process.env.BSKY_BSYNC_PORT || 2511)
// Comma-separated PDS firehose origins, e.g. "wss://pds1.example.com,wss://pds2.example.com"
const PDS_HOSTS = (process.env.BSKY_REPO_PROVIDERS || '').split(',').map((s) => s.trim()).filter(Boolean)

if (!DB_URL) throw new Error('set BSKY_DB_POSTGRES_URL')
if (!PDS_HOSTS.length) throw new Error('set BSKY_REPO_PROVIDERS')

// One shared pool across data plane, bsync, and all ingesters.
const db = new bsky.Database({ url: DB_URL, schema: DB_SCHEMA, poolSize: 10 })

// Apply migrations on a throwaway connection (see dev-env/src/bsky.ts).
const migrationDb = new bsky.Database({ url: DB_URL, schema: DB_SCHEMA })
await migrationDb.migrateToLatestOrThrow()
await migrationDb.close()

const dataplane = await bsky.DataPlaneServer.create(db, DATAPLANE_PORT, PLC_URL)
const bsync = await bsky.MockBsync.create(db, BSYNC_PORT)

// One RepoSubscription per PDS, all writing to the same DB (no relay needed).
const subs = PDS_HOSTS.map((service) =>
  new bsky.RepoSubscription({ service, db, idResolver: dataplane.idResolver }),
)
for (const sub of subs) sub.start()

console.log(`data plane on :${DATAPLANE_PORT}, mock bsync on :${BSYNC_PORT}, ingesting from`, PDS_HOSTS)

const shutdown = async () => {
  await Promise.all(subs.map((s) => s.destroy()))
  await bsync.destroy()
  await dataplane.destroy()
  await db.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```

All of `Database`, `DataPlaneServer`, `MockBsync`, `RepoSubscription` are re-exported from
`@atproto/bsky`. Each ingester keeps an **in-memory** cursor (`MemoryRunner`, start cursor 0),
so on restart it replays from the start of each PDS's available backfill window — fine for a
small test net.

Create the database once before first run (e.g. `createdb -h localhost -U pg bsky`); the script
applies the schema migrations itself.

---

## 6. Run the API server

Use the existing service entrypoint and Dockerfile ([`services/bsky`](.)). It reads its
configuration from the environment ([`ServerConfig.readEnv`](../../packages/bsky/src/config.ts))
and boots `BskyAppView`:

```bash
cd services/bsky
BSKY_PUBLIC_URL=https://appview.example.com \
BSKY_PORT=2584 \
BSKY_DID_PLC_URL=https://plc.directory \
BSKY_DATAPLANE_URLS=http://localhost:2510 \
BSKY_DATAPLANE_HTTP_VERSION=1.1 \
BSKY_BSYNC_URL=http://localhost:2511 \
BSKY_BSYNC_HTTP_VERSION=1.1 \
BSKY_SERVER_DID=did:web:appview.example.com \
BSKY_SERVICE_SIGNING_KEY=<hex private key> \
BSKY_ADMIN_PASSWORDS=<password> \
MOD_SERVICE_DID=did:example:mod \
BSKY_BLOB_CACHE_LOC=/var/cache/bsky-img \
NODE_ENV=production \
node api.ts
```

The Connect-RPC data plane defaults to HTTP/2; the bootstrap above serves plain HTTP/1.1, so set
`BSKY_DATAPLANE_HTTP_VERSION=1.1` and `BSKY_BSYNC_HTTP_VERSION=1.1` (the dev-env harness does the
same). For containerized runs, use the multi-stage [`Dockerfile`](./Dockerfile).

---

## 7. Environment variable reference

Source of truth: [`packages/bsky/src/config.ts`](../../packages/bsky/src/config.ts).

**Required (API server):**

| Var | Value for this setup |
|---|---|
| `BSKY_PUBLIC_URL` | external URL of the API server (also the base for `/img/...` URLs) |
| `BSKY_DATAPLANE_URLS` | `http://localhost:2510` (comma-separate if multiple) |
| `BSKY_BSYNC_URL` | `http://localhost:2511` (MockBsync) |
| `BSKY_SERVICE_SIGNING_KEY` | secp256k1 private key, hex |
| `BSKY_ADMIN_PASSWORDS` | comma-separated admin password(s) |
| `MOD_SERVICE_DID` | any DID string — only used in auth; no mod service runs |
| `BSKY_DID_PLC_URL` | `https://plc.directory` |

**Images — built-in Sharp resizer:**

| Var | Value |
|---|---|
| `BSKY_CDN_URL` / `BSKY_IMG_URI_ENDPOINT` | **leave unset** — this enables the built-in resizer |
| `BSKY_BLOB_CACHE_LOC` | persistent path/volume, e.g. `/var/cache/bsky-img` |

With no CDN configured, the AppView resolves each blob's source PDS via the data plane, fetches it
from that PDS's `com.atproto.sync.getBlob`, verifies the CID, resizes with Sharp, and caches to
disk. See [`packages/bsky/src/image/server.ts`](../../packages/bsky/src/image/server.ts),
[`blob-resolver.ts`](../../packages/bsky/src/api/blob-resolver.ts), and
[`image/sharp.ts`](../../packages/bsky/src/image/sharp.ts). Image URLs are built as
`{BSKY_PUBLIC_URL}/img/...`, so `BSKY_PUBLIC_URL` must be externally reachable. Sharp is CPU- and
memory-hungry; give the cache a real volume.

> Note: `cdn.bsky.app` was deliberately **not** used — it only holds blobs that exist on
> production, so it would 404 for content authored on your own test PDSes.

**Bootstrap (data plane / ingester):**

| Var | Value |
|---|---|
| `BSKY_DB_POSTGRES_URL` | `postgres://pg:password@localhost:5432/bsky` |
| `BSKY_DB_POSTGRES_SCHEMA` | optional schema name |
| `BSKY_REPO_PROVIDERS` | comma-separated PDS firehose origins, e.g. `wss://pds1.example.com,wss://pds2.example.com` |
| `BSKY_DATAPLANE_PORT` / `BSKY_BSYNC_PORT` | `2510` / `2511` (match the API server's URLs) |

**Optional services — omit all of them** for a de-federated net (endpoints degrade or disable
gracefully): `BSKY_SEARCH_URL`, `BSKY_SUGGESTIONS_URL`, `BSKY_TOPICS_URL`, `BSKY_COURIER_URL`,
`BSKY_ROLODEX_URL`. Set `BSKY_LABELS_FROM_ISSUER_DIDS` only if you run a labeler whose label
records you want surfaced.

---

## 8. Reverse proxy / TLS

Terminate TLS in front of the API server (the data plane and MockBsync stay private on
localhost). Example nginx:

```nginx
server {
  listen 443 ssl;
  server_name appview.example.com;
  ssl_certificate     /etc/letsencrypt/live/appview.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/appview.example.com/privkey.pem;
  location / {
    proxy_pass http://127.0.0.1:2584;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_http_version 1.1;
    proxy_buffering off;
  }
}
```

---

## 9. Operational notes

- **Build before deploy.** Run `pnpm codegen` (after any lexicon change) and `pnpm build` so the
  generated lexicon/protobuf code is present. The data plane talks Connect-RPC over generated
  protobuf bindings.
- **Restart / backfill.** Ingester cursors are in-memory and start at 0, so a restart replays
  the PDS's available backfill window. For small test PDSes this is cheap; for larger repos
  expect a re-index burst on restart. (Persisting cursors would require extending
  [`subscription.ts`](../../packages/bsky/src/data-plane/server/subscription.ts) — out of scope here.)
- **What breaks without the optional services:** no full-text search (`searchPosts`/`searchActors`
  degrade), no suggested follows/feeds, no trending topics, no push notifications (in-app
  notifications still work via the indexed `notification` table), and no contact import. None of
  these block core timeline/profile/thread functionality.
- **Moderation.** `MOD_SERVICE_DID` only needs to be a syntactically valid DID for auth; no Ozone
  instance is required. Labels are surfaced from indexed labeler records — only relevant if you
  run a labeler and list it in `BSKY_LABELS_FROM_ISSUER_DIDS`.
- **Local smoke test.** `make run-dev-env` boots this exact PDS + data plane + ingester + MockBsync
  constellation in-process — a good way to sanity-check behavior before deploying.
