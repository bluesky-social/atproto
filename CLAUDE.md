# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This is the TypeScript reference implementation of [AT Protocol](https://atproto.com), the decentralized social media protocol behind Bluesky. It is a pnpm monorepo (runtime floor Node.js ≥22; local dev and CI build/verify default to Node 24 via `.nvmrc` — only the test matrix runs on 22) containing client libraries, schema/codegen tooling, and the two main service implementations: the Personal Data Server (PDS) and the `app.bsky` AppView.

Workspace layout (see [pnpm-workspace.yaml](./pnpm-workspace.yaml) and [tsconfig.json](./tsconfig.json)):

- [packages/\*](packages/) — top-level libraries: `api`, `common`, `crypto`, `identity`, `lexicon`, `repo`, `syntax`, `xrpc`, `xrpc-server`, `pds`, `bsky`, `bsync`, `ozone`, `dev-env`, `dev-infra`, etc.
- [packages/lex/\*](packages/lex/) — the modern type-safe Lexicon SDK family (`@atproto/lex`, `lex-builder`, `lex-cbor`, `lex-client`, `lex-data`, `lex-document`, `lex-json`, `lex-resolver`, `lex-server`, `lex-schema`, `lex-installer`, `lex-password-session`). New service code should use this in preference to the older `@atproto/api` / `@atproto/lexicon` / `@atproto/xrpc` / `@atproto/lex-cli` stack — see the `lex-sdk` skill.
- [packages/oauth/\*](packages/oauth/) — OAuth client/provider implementations and JWK helpers.
- [packages/internal/\*](packages/internal/) — `@atproto-labs/*` internal shared utilities (fetch, handle/identity/DID resolvers, simple-store, pipe, xrpc-utils, rollup plugin).
- [services/{pds,bsky,bsync,ozone}](services/) — thin runtime wrappers; the actual implementation code lives in `packages/{pds,bsky,bsync,ozone}`.
- [lexicons/](lexicons/) — canonical JSON Lexicon schemas for `com.atproto.*`, `app.bsky.*`, `chat.bsky.*`, `tools.ozone.*`. These are the source-of-truth that codegen consumes.
- [interop-test-files/](interop-test-files/) — language-neutral protocol conformance fixtures. Don't edit unless changing protocol-level behavior; these are shared across SDKs.

## Common commands

Whole-repo verification commands (from root):

```bash
pnpm verify         # parallel: style + lint
pnpm build --force  # single root `tsgo --build` over the project-references graph, then UI bundlers
pnpm codegen        # parallel codegen across all packages; runs from .ts sources via Node type-stripping
```

The pipeline is: `build:tooling` → `codegen` → `prebuild` → `build` (one `tsgo --build tsconfig.json` at the root) → `postbuild` (Vite/UI bundlers).

The [Makefile](Makefile) wraps the most common entry points: `make build`, `make test`, `make lint`, `make fmt`, `make codegen`, `make run-dev-env` (boots the in-process PDS+AppView+bsync+plc+ozone constellation), `make run-dev-env-logged` (same with `pino-pretty` log output), `make fmt-lexicons` (eslint-fix on `lexicons/*.json`).

Per-package work — **always run from inside the package directory**, not from the root:

```bash
cd packages/<pkg>
pnpm exec tsgo --build tsconfig.build.json   # build that package + its referenced deps
pnpm test                                    # run that package's test suite
pnpm exec prettier --write <path>            # format specific files only
pnpm exec eslint --fix <path>                # lint specific files only
```

Every package now ships a `tsconfig.build.json` (composite, with explicit `references` to its workspace deps) and a `tsconfig.test.json` for the test sources. The root `tsconfig.json` is a project-graph aggregator only.

Avoid `pnpm run style:fix` (whole-repo prettier) unless the user explicitly asks for a repo-wide formatting pass.

## Tests

Before writing or extending any test, invoke the `testing` skill ([.claude/skills/testing/SKILL.md](.claude/skills/testing/SKILL.md)). It covers runner selection (vitest vs jest), file layout, and tsconfig setup. For browser-driven UI tests, or for demoing/debugging the OAuth flows or the Account Manager interface, invoke the `playwright` skill ([.claude/skills/playwright/SKILL.md](.claude/skills/playwright/SKILL.md)) instead.

## Codegen

After editing anything under [lexicons/](lexicons/), run `pnpm codegen` from the repo root before building or testing. The `bsky` package additionally runs `buf generate` for protobuf bindings against `bsync` as part of its codegen step.

For everything else lexicon-related — `lex install` / `lex build`, the per-package `prebuild` setup, and migrating from the legacy `@atproto/api` / `@atproto/lexicon` / `@atproto/xrpc` / `@atproto/lex-cli` stack to the new `@atproto/lex` family — invoke the `lex-sdk` skill ([.claude/skills/lex-sdk/SKILL.md](.claude/skills/lex-sdk/SKILL.md)).

## Architecture notes

- **Lexicons are the contract.** The JSON files in [lexicons/](lexicons/) drive both client types and server route validation. Service packages don't hand-write XRPC method signatures — they import the generated definitions from their `src/lexicons/` directory (gitignored / regenerated).
- **PDS** ([packages/pds](packages/pds)) — a single-tenant atproto server: account management, repo storage (kysely-over-sqlite), actor storage (kysely-over-postgres), email, OAuth provider, blob storage. Runtime entry point is [services/pds](services/pds); production code is in `packages/pds/src`.
- **Bsky AppView** ([packages/bsky](packages/bsky)) — read-side service for `app.bsky.*` queries (timelines, profiles, feed generators, hydration pipeline, GraphQL-like view composition). Talks to PDSes via XRPC and to `bsync` via Connect-RPC (protobuf in `packages/bsky/proto`). Runtime entry point in [services/bsky](services/bsky).
- **Bsync** ([packages/bsync](packages/bsync)) — internal service for cross-AppView synchronization (mutes, notifications). Connect-RPC interface.
- **Ozone** ([packages/ozone](packages/ozone)) — moderation service for `tools.ozone.*`.
- **dev-env** ([packages/dev-env](packages/dev-env)) — boots a full PDS + AppView + bsync + plc + ozone constellation in-process for tests and the `make run-dev-env` REPL. Most integration tests in `pds`/`bsky`/`ozone` use it as a fixture builder.
- **OAuth** ([packages/oauth](packages/oauth)) — split into `oauth-types` (shared schemas), `oauth-client` (browser/node/expo variants), `oauth-provider` (used inside the PDS), and `oauth-scopes`.

## Conventions

- Node ≥22 runtime floor; build/dev default to Node 24 (`.nvmrc`). ESM only (`"type": "module"` in every package). Use `node --enable-source-maps` for production-style runs.
- TypeScript compilation uses `tsgo` (TS7, `@typescript/native-preview`), not `tsc`. There is no per-package `typescript` devDependency — `tsgo` is hoisted at the root.
- Import paths use workspace protocol (`workspace:^`). Don't pin internal packages to a published version.
- Don't refactor unrelated code; this project's contribution guidelines explicitly discourage large refactors and unsolicited tooling changes (see [README.md](README.md) "Contributions").
- Don't add new dependencies without strong justification.
- When picking lexicon SDK APIs in new code, prefer the `@atproto/lex` family over the old `@atproto/api` stack.

## Troubleshooting

- **Stale codegen.** If the build fails due to a generated file in [packages/api](packages/api) or [packages/ozone](packages/ozone) being out of date, run `pnpm run codegen && pnpm run build` from those packages, then re-run the build. This is only needed on these two packages because their `prebuild` step skips codegen as a performance optimization.
- **Codegen ran but produced stale output.** Codegen relies on `pnpm build:tooling` to build the `@atproto/lex-cli` and `@atproto/lex-builder` packages first. If you see a codegen failure, run `pnpm build:tooling` from the root, then re-run codegen.
- **End-to-end test fails with stale infra.** If docker containers persist across test runs, reset them with `cd packages/dev-infra && docker compose down --volumes`.
