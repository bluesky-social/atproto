# @atproto/bsky — AppView (read API)

The Bluesky AppView. Aggregates data from PDSes via the firehose and serves the `app.bsky.*` read endpoints (feeds, search, profiles, threads). In production this is split: `bsky` answers XRPC, `dataplane` indexes the firehose, `bsync` syncs cross-cutting state. They share the same package code but are deployed separately under `services/`.

## Stack

- **Framework:** Express + `@atproto/xrpc-server`
- **DB (reads):** Postgres via `kysely`
- **gRPC:** `@connectrpc/connect` between `bsky` and `dataplane`
- **Cache:** Redis (`ioredis`) — view caches, rate limiting
- **Feature flags:** Custom (`feature-gates.ts`), optional etcd watcher
- **KWS:** Children's-safety integration (`kws.ts`) — age verification
- **Courier:** Notification fan-out (`courier.ts`)
- **Stash:** Cross-AppView keyvalue store (`stash.ts`)
- **Rolodex:** Identity/handle directory (`rolodex.ts`)

## Layout (`src/`)

```
api/                       XRPC handlers for app.bsky.*, chat.bsky.*, tools.ozone.*, com.atproto.*
auth-verifier.ts           Token + service-auth verification (delegates to PDS for user tokens)
config.ts                  Env parsing
context.ts                 AppContext DI container
data-plane/
  bsync/                   bsync client
  client/                  gRPC client wrapping the dataplane
  server/                  Dataplane server implementation (Postgres reads)
hydration/                 N-step hydration: take a set of refs → flesh into full views
views/                     Final view assembly (posts, profiles, threads, ...)
pipeline.ts                Standard hydrate → view pipeline used by handlers
proto/                     ConnectRPC-generated bsync + dataplane protocol stubs
courier.ts                 Push notification dispatcher
kws.ts                     Kids Web Services age gate
feature-gates.ts           Feature-flag plumbing
etcd.ts                    Optional etcd watcher for live config
```

## Key patterns

- **Hydration → View** — handlers don't query Postgres directly. They build a `HydrationState`, hand it to `views/*`, and let the view assemble the response. Adding a new field usually means: add to hydrator, add to view, register in lexicon.
- **Dataplane indirection** — DB reads go through the dataplane gRPC interface (even when bsky+dataplane are co-deployed). Don't reach for `kysely` from inside an XRPC handler.
- **No writes** — this is a read service. Mutations belong on the PDS or, for AppView-private state (mutes, blocks, notifs), in bsync.

## Commands

```sh
pnpm --filter @atproto/bsky test
pnpm --filter @atproto/bsky build
```

Service entrypoint lives in `services/bsky/api.js`. The dataplane entrypoint is `services/dataplane/index.js`.

## See also

- `.claude/docs/bsky/overview.md` — architectural deep dive
- `.claude/docs/bsky/dataplane.md` — indexer details
- `.claude/docs/bsky/bsync.md` — sync service
- `.claude/docs/atproto/federation-and-firehose.md` — where the data comes from
