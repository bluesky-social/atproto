# @atproto/pds — Personal Data Server

Reference PDS implementation, **heavily forked** for W Social. Owns user data and accepts writes (login, posting, profile edits, blob uploads). Talks to AppView via standard atproto APIs. Forked code lives mostly in `src/account-manager/`, `src/api/eu/`, `src/api/io/trustanchor/`, and the migrations directory.

## Stack

- **Framework:** Express + `@atproto/xrpc-server`
- **DB:** SQLite via `better-sqlite3` + `kysely` query builder (one DB per account in `actor-store/`, plus a shared account DB)
- **Cache/queue:** Redis (`ioredis`)
- **Auth:** Custom JWT layer (`jose`) + Neuro RemoteLogin integration + QuickLogin OAuth bridge
- **Mail:** Nodemailer (legacy); Brevo via Python `wadmin` modules (current)
- **Crypto:** `@atproto/crypto` for signing keys

## Layout (`src/`)

```
account-manager/           Account DB, login flow, invitation system, WID inventory
  db/migrations/           Numbered TS migrations (append-only)
  helpers/
    neuro-auth-manager.ts        Neuro RemoteLogin integration
    quicklogin-oauth-bridge.ts   QuickLogin → OAuth bridge
    ...
actor-store/               Per-account repo storage (each user has their own SQLite)
api/
  com/atproto/             Upstream com.atproto.* handlers
    admin/                 addNeuroLink, listNeuroAccounts, etc.
  app/, chat/              Upstream app.bsky.* and chat.bsky.* (proxied to AppView)
  eu/wsocial/              W Social custom endpoints (admin, quicklogin, server)
  io/trustanchor/          QuickLogin protocol handlers
auth-verifier.ts           Access-token + service-auth verification
auth-scope.ts              Scope/role definitions
sequencer/                 Repo commit firehose emitter
mailer/                    Email templates + send
config/                    Env parsing and config object
context.ts                 AppContext — central DI container
did-cache/                 DID resolution cache
disk-blobstore.ts          Blob storage (filesystem)
image/                     Thumbnail/preview generation
pipethrough.ts             Proxy reads to AppView
read-after-write/          RAW consistency helpers
repo/                      MST commit pipeline
well-known.ts              DID + atproto-did discovery routes
```

## Key patterns

- **Lexicon-first endpoints** — JSON in `lexicons/eu/wsocial/<name>.json`, run `make codegen` from repo root, then implement handler in `src/api/eu/wsocial/<name>.ts` and register in `src/api/eu/wsocial/index.ts`.
- **Migrations are append-only** — never rename or reorder. Add `NNN-name.ts`, export from `migrations/index.ts`. The current head is `023-refresh-token-login-jid.ts`.
- **AppContext DI** — services get the `AppContext` injected and pull what they need from it. Don't create new ad-hoc singletons.
- **Neuro/QuickLogin integration** lives in `account-manager/helpers/`. Don't sprinkle Neuro calls across the codebase — go through the manager.

## Commands

```sh
pnpm --filter @atproto/pds test
pnpm --filter @atproto/pds build
```

Tests need Redis + Postgres — run via root `make test`, which wraps with `packages/dev-infra/with-test-redis-and-db.sh`.

## Tests

`tests/` is rich and the **canonical pattern source**. When adding tests:

- W Social admin/auth tests: `admin-neuro-endpoints.test.ts`, `quicklogin-auth.test.ts`, `invitation-*.test.ts`
- Use the `runTestServer()` / `TestNetwork` helpers from `@atproto/dev-env`
- For Neuro flows, use `mock-neuro-server/` as the test double (started in test setup)

## Code style

- Prettier formatted (root config)
- ESLint with the repo plugins; `pnpm verify` runs the full chain
- No `any` unless commented

## See also

- `.claude/docs/pds/overview.md` — deeper internals
- `.claude/docs/pds/neuro-auth.md` — Neuro integration flow
- `.claude/docs/pds/quicklogin.md` — QuickLogin / W Identity bridge
- `.claude/docs/pds/invitations.md` — invitation lifecycle
- `.claude/docs/pds/migrations.md` — migration authoring rules
