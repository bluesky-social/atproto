# w-social-atproto — W Social fork of AT Protocol

W Social's fork of `bluesky-social/atproto`. The **source of truth** for the W Social PDS, AppView (bsky + dataplane), bsync, and ozone services. Custom `eu.wsocial.*` lexicons, Neuro RemoteLogin auth, QuickLogin (W Identity), invitation system, and Python `wadmin` tooling are layered on top of the upstream monorepo.

## Workspace context

This repo lives in a multi-repo workspace at `../` (W Social). The parent `../CLAUDE.md` indexes sibling repos in `../.claude/*.md`. **Do not edit sibling repos from here.** The siblings worth knowing:

- `w-social-appview/` — Helm charts that deploy bsky + dataplane + bsync built from this repo
- `w-social-infrastructure/` — Nomad job that runs the PDS built from this repo
- `w-social-next-js/` — Expo client (iOS/Android/web) that talks to PDS + AppView
- `ozone/` — separate moderation console UI; `packages/ozone/` here is the backend service
- `atproto/` — upstream reference clone, read-only; diff against it when merging upstream

## Monorepo layout

```
packages/                 ~50 TS packages, pnpm workspaces
  pds/                    PDS — heavily modified for W Social
  bsky/                   AppView (federated reads)
  ozone/                  Moderation backend
  bsync/                  Stash/blob sync
  ws-client/              W Social addition — WebSocket client
  lex-cli/                Codegen CLI (lexicon → TS)
  lexicon/, identity/, repo/, sync/, xrpc/, xrpc-server/, crypto/, did/, syntax/, common/, ...
  lex/*                   Lexicon toolkit subpackages
  oauth/*                 OAuth provider + client packages
  internal/*              Internal helpers (handle-resolver, simple-store, ...)
services/                 Production runtime entrypoints + Dockerfiles
  pds/, bsky/, dataplane/, bsync/, ozone/
lexicons/                 JSON lexicon schemas
  com/, app/, chat/, tools/, io/  upstream
  eu/wsocial/             W Social-only NSIDs (DO NOT touch others)
pds-wadmin*               Python admin CLI (Brevo email + admin tasks)
mock-neuro-server/        Test double for Neuro RemoteLogin
quicklogin-client/        Reference QuickLogin web client
examples/                 Demo apps (remotelogin, ...)
interop-test-files/       Cross-implementation conformance fixtures
```

## Key commands

```sh
make deps                 # pnpm install --frozen-lockfile
make build                # codegen + tsc across all packages
make codegen              # regenerate TS clients/servers from lexicons/
make test                 # full test suite (requires Redis + Postgres via dev-infra)
make lint                 # ESLint + Prettier + tsc verify
make fmt                  # auto-fix lint + format
make run-dev-env          # local PDS + AppView with seeded data
make run-dev-env-logged   # same, pino-pretty formatted
pnpm dev                  # watch-mode tsc across all packages
```

## Tool versions

- Node.js `>=18.7.0` (currently pinned to 18 via `make nvm-setup`)
- pnpm `8.15.9+` (managed via Corepack)
- TypeScript `^5.8.3`
- Python `>=3.10` (for `pds-wadmin-modules/`)

## Conventions

- **Don't modify upstream lexicons** (`com.atproto.*`, `app.bsky.*`, `chat.bsky.*`, `tools.ozone.*`). Federation breaks if we diverge. Add to `lexicons/eu/wsocial/` instead.
- **Lexicon-first endpoints** — add the JSON schema first, run `make codegen`, then implement the handler in `packages/pds/src/api/eu/wsocial/...` (or wherever the NSID maps).
- **PDS migrations** are numbered TS files in `packages/pds/src/account-manager/db/migrations/` — never rename existing migrations, only append.
- **Commits:** conventional-ish (`feat:`, `fix:`, `chore:`) but the existing history is mixed; match nearby commits.
- **TypeScript strict** — no `any` unless justified; `noImplicitAny: true` repo-wide.
- **Testing** — Jest is primary; some newer packages use Vitest (`vitest.config.ts` at root). Tests requiring storage run under `packages/dev-infra/with-test-redis-and-db.sh`.

## Domain dictionary

| Term | Meaning |
|---|---|
| **PDS** | Personal Data Server — owns user data and writes (login, posts, profile) |
| **AppView** | Aggregation service for read APIs (feeds, search, profiles); `bsky` + `dataplane` |
| **dataplane** | AppView's indexer; gRPC + firehose consumer, owns the read database |
| **bsync** | Synchronization service between PDS and AppView (subscriptions, mutes, blocks) |
| **firehose** | The WebSocket repo-subscription stream that drives all indexers |
| **lexicon** | The schema language defining XRPC endpoints; NSID-addressed JSON |
| **NSID** | Namespaced ID — reverse-DNS string identifying a lexicon (e.g. `eu.wsocial.admin.createPassInvitation`) |
| **XRPC** | The HTTP+JSON RPC protocol used between atproto services |
| **DID** | Decentralized identifier for accounts (`did:plc:...`, `did:web:...`) |
| **WID** | W Identity — wallet/credential issued by Neuro; binds atproto accounts to real-world identity |
| **JID** | Juridical identifier from Neuro (legal/national ID); used for invitation matching |
| **Neuro** | Trust-anchor identity provider integrated via RemoteLogin |
| **QuickLogin** | OAuth-like flow for the W Identity mobile app (lives under `io.trustanchor.quicklogin.*`) |

## Documentation

All deep documentation is indexed in `.claude/docs/index.md`. Consult the index to find the right doc for any topic.

**At session start:** Check `.claude/docs/index.md` when you need deeper context beyond what's in this file and the package CLAUDE.md files. Also check `.claude/memory/MEMORY.md` for team gotchas.

**After significant changes:** If your work affects architecture, workflows, conventions, or any topic covered in `.claude/docs/`, update the relevant doc and the index if a new doc was added.

## Package-level context

Most packages have their own `CLAUDE.md` with stack, layout, and patterns. See:

- `packages/pds/CLAUDE.md` — PDS internals + W Social customisations
- `packages/bsky/CLAUDE.md` — AppView read service
- `packages/dataplane/CLAUDE.md` and `services/dataplane/` — indexer
- `services/CLAUDE.md` — production entrypoints, Dockerfiles, runtime config
- `lexicons/CLAUDE.md` — lexicon authoring rules
- and one for every other major package
