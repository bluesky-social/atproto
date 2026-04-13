# CLAUDE.md - AT Protocol Reference Implementation (Fork)

> **See also:** [../CLAUDE.md](../CLAUDE.md) for workspace-level context
> (Periwinkle architecture, environments)

This is Periwinkle's fork of Bluesky's AT Protocol TypeScript reference
implementation. It contains the canonical server-side implementation of the
protocol: PDS, AppView, Ozone moderation, OAuth provider, and all lexicon
schemas.

## Package Manager

**This repo uses pnpm** (v8.15.9). All other Periwinkle repos use npm — do NOT
use npm here.

## Commands

```bash
pnpm install --frozen-lockfile   # install deps
pnpm build                       # build all packages (topological order)
pnpm test                        # run all tests (requires Docker: Postgres 14 + Redis 7)
pnpm verify                      # lint + typecheck + style check
pnpm format                      # eslint fix + prettier write
pnpm codegen                     # regenerate TypeScript from lexicon JSON schemas
make run-dev-env                 # start local PDS + AppView + Ozone
```

## Project Structure

```
atproto/
├── lexicons/              # Canonical Lexicon JSON schemas (com.atproto.*, app.bsky.*, tools.ozone.*)
├── packages/
│   ├── api/               # @atproto/api — public client library
│   ├── pds/               # @atproto/pds — Personal Data Server
│   ├── bsky/              # @atproto/bsky — AppView service
│   ├── ozone/             # @atproto/ozone — moderation service
│   ├── bsync/             # @atproto/bsync — sync service
│   ├── repo/              # @atproto/repo — MST / repo data structures
│   ├── crypto/            # @atproto/crypto — signing keys (P-256, secp256k1)
│   ├── sync/              # @atproto/sync — firehose subscription client
│   ├── syntax/            # @atproto/syntax — AT identifier validators
│   ├── identity/          # @atproto/identity — DID + handle resolution
│   ├── common/            # @atproto/common — Node.js shared utilities (logger, TID)
│   ├── common-web/        # @atproto/common-web — browser-safe utilities
│   ├── xrpc/              # @atproto/xrpc — client-side XRPC HTTP
│   ├── xrpc-server/       # @atproto/xrpc-server — server-side XRPC HTTP
│   ├── lex-cli/           # @atproto/lex-cli — codegen CLI
│   ├── lex/               # @atproto/lex-* packages (schema, builder, server, etc.)
│   ├── oauth/             # @atproto/oauth-* packages (client, provider, JWK)
│   ├── internal/          # @atproto-labs/* experimental packages
│   ├── dev-env/           # @atproto/dev-env — local test network harness
│   └── dev-infra/         # Docker Compose + scripts for test infrastructure
├── services/              # Runtime wrappers for PDS, bsky, ozone, bsync (dd-trace, otel)
├── tsconfig/              # Shared tsconfig bases (node.json, browser.json, etc.)
├── interop-test-files/    # Cross-language test fixtures
└── Makefile               # Developer convenience targets
```

## Code Style

- **Prettier**: no semicolons, single quotes, 2-space indent, trailing commas
- **ESLint**: import ordering enforced (`builtin` → `external` → `@atproto` →
  `parent` → `sibling`), `no-var` error, `prefer-const` warn, `eqeqeq` enforced,
  Node protocol imports required (`node:fs`)
- `@typescript-eslint/no-explicit-any` is OFF
- Unused variables: error with `argsIgnorePattern: "^_"`

## Key Conventions

- **Files**: `kebab-case.ts`; classes: `PascalCase`; functions/variables:
  `camelCase`
- **Generated code is committed**: `src/lexicon/` directories contain TypeScript
  generated from `lexicons/` — regenerate with `pnpm codegen` when lexicons
  change
- **Changesets for versioning**: run `pnpm changeset` before merging (not
  release-please)
- **Database migrations**: Kysely `Migrator` with timestamped files
  (`20230309T045948368Z-init.ts`), create via `pnpm migration:create`
- **Logging**: `pino` with `subsystemLogger(name)` from `@atproto/common`

## Architectural Patterns

### AppContext Dependency Injection

Every service creates an `AppContext` holding all stateful dependencies (db,
config, auth verifier, etc.). Routes receive `ctx` — no global singletons.

### Skeleton/Hydration/Rules/Presentation Pipeline (AppView)

API endpoints in `@atproto/bsky` follow a strict four-step pipeline:

1. **Skeleton** — resolve relevant DIDs/URIs
2. **Hydration** — batch-fetch data from dataplane
3. **Rules** — apply moderation/visibility filtering
4. **Presentation** — format into API response

### Per-Actor SQLite Stores (PDS)

Each user/DID gets its own SQLite file at
`<actorStoreDirectory>/<2-char-hash>/<did>/store.sqlite`. Separate
`account.sqlite` and `sequencer.sqlite` databases for account-level and
sequencer state.

### Lexicon-Driven Code Generation

`lex gen-server` generates typed request handlers from lexicon JSON.
`lex gen-api` generates typed client methods. Both output to `src/lexicon/` or
`src/client/`.

## Testing

- **Jest 28** with `@swc/jest` — used by service packages (pds, bsky, ozone,
  bsync, repo, etc.)
- **Vitest** — used by newer packages (syntax, tap, lex/_, oauth/_)
- Tests require Docker (Postgres 14 + Redis 7), spun up by
  `packages/dev-infra/with-test-redis-and-db.sh`
- Integration tests use `@atproto/dev-env` (`TestNetwork.create()`) for full
  in-process services
- `SeedClient` provides helpers to create users, posts, follows, likes
- 8-shard CI matrix with `--maxWorkers=1`
- Test timeout: 60s

## Environment Variables (PDS)

All prefixed `PDS_`:

- `PDS_HOSTNAME`, `PDS_PORT`, `PDS_SERVICE_DID`
- `PDS_DATA_DIRECTORY` — root for SQLite files
- `PDS_BLOBSTORE_S3_BUCKET` or `PDS_BLOBSTORE_DISK_LOCATION`
- `PDS_JWT_SECRET`, `PDS_ADMIN_PASSWORD`, `PDS_DPOP_SECRET`
- `PDS_DID_PLC_URL`, `PDS_BSKY_APP_VIEW_URL`

See `packages/pds/src/config/env.ts` for the full list.
