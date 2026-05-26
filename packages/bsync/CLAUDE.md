# @atproto/bsync — AppView sync service

Synchronization service between PDSes and the AppView. Holds AppView-private state that isn't in user repos: notification preferences, push tokens, mute/block lists, subscription state. Exposed via ConnectRPC, called by bsky's handlers.

## Stack

- **RPC:** `@connectrpc/connect-node` (HTTP/2 by default)
- **DB:** Postgres + `kysely`
- **Proto:** generated under `src/proto/` from upstream `.proto` definitions

## Layout (`src/`)

```
client.ts                  Re-exported client used by bsky
config.ts                  Env parsing
context.ts                 AppContext
db/                        Postgres migrations + queries
proto/                     ConnectRPC stubs
routes/                    Service handlers (per RPC method)
```

## Commands

```sh
pnpm --filter @atproto/bsync test
pnpm --filter @atproto/bsync build
```

Service entrypoint: `services/bsync/`.

## See also

- `.claude/docs/bsky/bsync.md` — what state lives here and why
