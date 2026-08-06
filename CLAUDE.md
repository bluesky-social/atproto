# CLAUDE.md

## Repository overview

This is the TypeScript reference implementation of [AT Protocol](https://atproto.com), the decentralized social media protocol behind Bluesky. It is a pnpm monorepo (runtime floor Node.js ≥22; local dev and CI build/verify default to Node 24 via `.nvmrc` — only the test matrix runs on 22) containing client libraries, schema/codegen tooling, and the two main service implementations: the Personal Data Server (PDS) and the `app.bsky` AppView.

Workspace layout (see [pnpm-workspace.yaml](./pnpm-workspace.yaml) and [tsconfig.json](./tsconfig.json)):

- [packages/\*](packages/) — top-level libraries: `api`, `common`, `crypto`, `identity`, `lexicon`, `repo`, `syntax`, `xrpc`, `xrpc-server`, `pds`, `bsky`, `bsync`, `ozone`, `dev-env`, `dev-infra`, etc.
- [packages/lex/\*](packages/lex/) — the modern type-safe Lexicon SDK family (`@atproto/lex`, `lex-builder`, `lex-cbor`, `lex-client`, `lex-data`, `lex-document`, `lex-json`, `lex-resolver`, `lex-server`, `lex-schema`, `lex-installer`, `lex-password-session`). New service code should use this in preference to the older `@atproto/api` / `@atproto/lexicon` / `@atproto/xrpc` / `@atproto/lex-cli` stack — see the `lex-*` skills listed under [Codegen](#codegen).
- [packages/oauth/\*](packages/oauth/) — OAuth client/provider implementations and JWK helpers.
- [packages/internal/\*](packages/internal/) — `@atproto-labs/*` internal shared utilities (fetch, handle/identity/DID resolvers, simple-store, pipe, xrpc-utils).
- [services/{pds,bsky,bsync,ozone}](services/) — thin runtime wrappers; the actual implementation code lives in `packages/{pds,bsky,bsync,ozone}`.
- [lexicons/](lexicons/) — canonical JSON Lexicon schemas for `com.atproto.*`, `app.bsky.*`, `chat.bsky.*`, `tools.ozone.*`. These are the source-of-truth that codegen consumes.
- [interop-test-files/](interop-test-files/) — language-neutral protocol conformance fixtures, copied from [bluesky-social/atproto-interop-tests](https://github.com/bluesky-social/atproto-interop-tests/) (their canonical source, shared across SDKs). Don't edit unless changing protocol-level behavior; any edit must also be contributed upstream.

## Common commands

Whole-repo verification commands (from root):

```bash
# build:tooling → prebuild (codegen) → build:ts → build:ui
pnpm run build [--force]

# TypeScript-only build & typecheck
pnpm run build:ts [--force]

# force code generation (lexicons, protobuf, i18n, utils, etc.)
pnpm run codegen

# style + lint
pnpm run verify
pnpm run style:fix # Avoid, prefer per-file formatting & linting

# lint specific files only
pnpm exec eslint --fix <path>

# format specific files only
pnpm exec prettier --write <path>
```

Per-package work — **always run from inside the package directory**, not from the root:

```bash
cd packages/<pkg>
pnpm run build
pnpm run test
```

Every package ships a `tsconfig.build.json` (composite, with explicit `references` to its workspace deps), and nearly every package with tests adds a `tsconfig.test.json` for the test sources. The root `tsconfig.json` is a project-graph aggregator only.

Avoid `pnpm run style:fix` (whole-repo prettier) unless the user explicitly asks for a repo-wide formatting pass.

Run the formatter/linter once the work is complete: when about to commit, or when the user says the change is done, not after every small edit.

## Tests

Before writing or extending any test, invoke the `testing` skill ([.agents/skills/testing/SKILL.md](.agents/skills/testing/SKILL.md)). It covers runner selection (vitest vs jest), file layout, and tsconfig setup. For browser-driven UI tests, or for demoing/debugging the OAuth flows or the Account Manager interface, invoke the `playwright` skill ([.agents/skills/playwright/SKILL.md](.agents/skills/playwright/SKILL.md)) instead.

## Codegen

After editing anything under [lexicons/](lexicons/), or any `.proto` file, run `pnpm codegen` from the repo root.

The lexicon JSON schemas are derived into TypeScript runtime schemas by `@atproto/lex` (`lex build`, wired through each package's `prebuild`).

For working with that SDK, invoke the focused skills under [.agents/skills/](.agents/skills/): `lex-setup` (install/build config), `lex-schema` and `lex-data` (schemas and values), `lex-client` (calls out), `xrpc-server` (defining server routes), and `lexification-client` / `lexification-server` (migrating off the legacy stack). To sync `chat.bsky.*` schemas from the chat repo, use `update-chat-lexicons`.

## Architecture notes

- **Lexicons are the contract.** The JSON files in [lexicons/](lexicons/) drive both client types and server route validation. Service packages don't hand-write XRPC method signatures — they import the generated definitions from their `src/lexicons/` directory (gitignored / regenerated).
- ([packages/pds](packages/pds)) — a single-tenant atproto server: account management, repo storage (kysely-over-sqlite), actor storage (kysely-over-postgres), email, OAuth provider, blob storage. Runtime entry point is [services/pds](services/pds); production code is in `packages/pds/src`.
- ([packages/bsky](packages/bsky)) — read-side service for `app.bsky.*` queries (timelines, profiles, feed generators, hydration pipeline, GraphQL-like view composition). Talks to PDSes via XRPC and to `bsync` via Connect-RPC (protobuf in `packages/bsky/proto`). Runtime entry point in [services/bsky](services/bsky).
- ([packages/bsync](packages/bsync)) — internal service for cross-AppView synchronization (mutes, notifications). Connect-RPC interface.
- ([packages/ozone](packages/ozone)) — moderation service for `tools.ozone.*`.
- ([packages/dev-env](packages/dev-env)) — boots a full PDS + AppView + bsync + plc + ozone constellation in-process for tests and the `make run-dev-env` REPL. Most integration tests in `pds`/`bsky`/`ozone` use it as a fixture builder.

## Conventions

**Code style rules live in [STYLE_GUIDE.md](./STYLE_GUIDE.md)** — imports, typing, dependencies, change scope, and formatting. Read it before writing code. The rest of this section covers repository mechanics only.

- Node ≥22 runtime floor; build/dev default to Node 24 (`.nvmrc`). Use `node --enable-source-maps` for production-style runs.
- TypeScript compilation uses the native TS7 `tsc` (the standard `typescript` package). There is no per-package `typescript` devDependency — it is hoisted at the root. Note TS7 has no stable programmatic API yet; tools needing one must pin TS6.
- **Every package touched by a change needs a changeset entry.** Add a file under [.changeset/](.changeset/) listing each modified package with an appropriate bump level (`minor` for breaking or new public API, `patch` otherwise). Dependency-only bumps are generated automatically — don't list them by hand.

## Agent files

Agent files — this `CLAUDE.md`, the skills under [.agents/skills/](.agents/skills/), and any package-level equivalents — are part of the codebase and must stay in sync with it.

- **New pattern introduced** → document it in the relevant agent file (package-specific if scoped, global otherwise) so it can be re-applied.
- **Existing important pattern found undocumented** → add it.
- **Concept removed** → remove it from the agent files in the same change. Reviewers should check for this (see [.github/claude-review-prompt.md](.github/claude-review-prompt.md)).
- Keep them **as concise as possible**: only the minimal directives an expert needs. No tutorials, no restating what the code already says.

## Troubleshooting

- **Stale codegen.** If the build fails due to a generated file in [packages/api](packages/api) or [packages/ozone](packages/ozone) being out of date, run `pnpm run codegen && pnpm run build` from those packages, then re-run the build. This is only needed on these two packages because their `prebuild` step skips codegen as a performance optimization.
- **Codegen ran but produced stale output.** Codegen relies on `pnpm build:tooling` to build the `@atproto/lex-cli` and `@atproto/lex-builder` packages first. If you see a codegen failure, run `pnpm build:tooling` from the root, then re-run codegen.
- **End-to-end test fails with stale infra.** If docker containers persist across test runs, reset them with `cd packages/dev-infra && docker compose down --volumes`.
- **Nothing else worked.** `make clean` wipes every installed dependency (`node_modules`), build artifact (`dist`, `*.tsbuildinfo`), and prebuild/codegen output across all packages; follow it with `pnpm install && pnpm run build` to restore a clean state.
