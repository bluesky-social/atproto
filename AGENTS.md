# AGENTS.md

## Repository overview

This is the TypeScript reference implementation of [AT Protocol](https://atproto.com), the decentralized social media protocol behind Bluesky. It is a pnpm monorepo (runtime floor Node.js ≥22) containing client libraries, schema/codegen tooling, and the two main service implementations: the Personal Data Server (PDS) and the `app.bsky` AppView.

Workspace layout (see [pnpm-workspace.yaml](./pnpm-workspace.yaml) and [tsconfig.json](./tsconfig.json)):

- [packages/\*](packages/) — top-level libraries: `api`, `common`, `crypto`, `identity`, `lexicon`, `repo`, `syntax`, `xrpc`, `xrpc-server`, `pds`, `bsky`, `bsync`, `ozone`, `dev-env`, `dev-infra`, etc.
- [packages/lex/\*](packages/lex/) — the modern type-safe Lexicon SDK family (`@atproto/lex`, `lex-builder`, `lex-cbor`, `lex-client`, `lex-data`, `lex-document`, `lex-json`, `lex-resolver`, `lex-server`, `lex-schema`, `lex-installer`, `lex-password-session`). New service code should use this in preference to the older `@atproto/api` / `@atproto/lexicon` / `@atproto/xrpc` / `@atproto/lex-cli` stack — see the `lex-*` skills listed under [Codegen](#codegen).
- [packages/oauth/\*](packages/oauth/) — OAuth client/provider implementations and JWK helpers.
- [packages/internal/\*](packages/internal/) — `@atproto-labs/*` internal shared utilities (fetch, handle/identity/DID resolvers, simple-store, pipe, xrpc-utils).
- [services/{pds,bsky,bsync,ozone}](services/) — thin runtime wrappers; the actual implementation code lives in `packages/{pds,bsky,bsync,ozone}`.
- [lexicons/](lexicons/) — the canonical JSON Lexicon schemas for `com.atproto.*` and `tools.ozone.*` **only** (this repo is their source of truth). Other namespaces (`app.bsky.*`, `chat.bsky.*`, …) are vendored per-package from the `bsky` repo or the network — see [Codegen](#codegen). [lexicons-overrides/](lexicons-overrides/) holds local override documents shared across packages.
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

Every package ships a `tsconfig.build.json` (composite, with explicit `references` to its workspace deps), and nearly every package with tests adds a `tsconfig.test.json` for the test sources. A package with root-level config/script files (`vitest.config.ts`, `jest.config.cjs`, `lingui.config.ts`, `bin.js`, …) also adds a `tsconfig.config.json` so those files are type-checked — it extends [tsconfig/config.tsconfig.json](tsconfig/config.tsconfig.json) and `include`s the package's own `./*.{ts,js,cjs,mjs}`. When you add such a file to a package that has none, create `tsconfig.config.json` and reference it from the package `tsconfig.json` (`exclude` any root file that pulls `./src` or `./tests` into the program, e.g. a `jest.setup.ts`). The root `tsconfig.json` is a project-graph aggregator only.

Avoid `pnpm run style:fix` (whole-repo prettier) unless the user explicitly asks for a repo-wide formatting pass.

Run the formatter/linter once the work is complete: when about to commit, or when the user says the change is done, not after every small edit.

## Tests

For Ozone integration tests, verify state through existing endpoints (for example, `queryEvents` for appeal events and `queryReports` for report state). Use direct database access only for fixtures that cannot be created through an API, or for tests specifically exercising database behavior.

Before writing or extending any test, invoke the `testing` skill ([.agents/skills/testing/SKILL.md](.agents/skills/testing/SKILL.md)). It covers runner selection (vitest vs jest), file layout, and tsconfig setup. For browser-driven UI tests, or for demoing/debugging the OAuth flows or the Account Manager interface, invoke the `playwright` skill ([.agents/skills/playwright/SKILL.md](.agents/skills/playwright/SKILL.md)) instead.

## Codegen

The repo-root [lexicons/](lexicons/) holds the canonical `com.atproto.*` / `tools.ozone.*` schemas **only** — this repo is their source of truth. Every other namespace (`app.bsky.*`, `chat.bsky.*`, `site.standard.*`, …) is vendored **per package**: each package lists the NSIDs it needs and where to resolve them (the root `lexicons` directory, the `bsky` GitHub repo, the network, or the shared [lexicons-overrides/](lexicons-overrides/)) in its own committed `lexicons.json`. A package's `prebuild` runs `lex install --ci` (resolving JSON into its gitignored `./lexicons`) then `lex build` (generating the gitignored `./src/lexicons` TypeScript tree that code imports). **Full how-to: the ["Working with lexicons"](CONTRIBUTING.md#working-with-lexicons) section of CONTRIBUTING.md and the `lex-setup` skill.**

- **Add/refresh an external lexicon in a package:** `cd packages/<pkg> && pnpm lex:install <nsid>` (adds it plus transitive deps); `pnpm lex:update` refreshes installed ones.
- **Edit a canonical lexicon:** change it under [lexicons/](lexicons/), then run `pnpm lex:update-local` from the repo root to propagate the new CID into every dependent package's `lexicons.json`. (After editing a `.proto` file instead, run `pnpm codegen` from the root.)

For working with the generated SDK, invoke the focused skills under [.agents/skills/](.agents/skills/): `lex-setup` (lexicons.json / resolvers / codegen wiring), `lex-schema` and `lex-data` (schemas and values), `lex-client` (calls out), `xrpc-server` (defining server routes), and `lexification-client` / `lexification-server` (migrating off the legacy stack). To sync `chat.bsky.*` schemas from the chat repo, use `update-chat-lexicons`.

## Architecture notes

- **Lexicons are the contract.** Lexicon schemas drive both client types and server route validation. Service packages don't hand-write XRPC method signatures — they import the generated definitions from their `src/lexicons/` directory (gitignored; regenerated from the package's `lexicons.json` — see [Codegen](#codegen)).
- ([packages/pds](packages/pds)) — a single-tenant atproto server: account management, repo storage (kysely-over-sqlite), actor storage (kysely-over-postgres), email, OAuth provider, blob storage. Runtime entry point is [services/pds](services/pds); production code is in `packages/pds/src`.
  - Outbound requests to a URL resolved from a DID document are untrusted. Make them with `ctx.safeClient(url).xrpc(…)`, never a bare `xrpc(url, …)`, which uses the global fetch and bypasses the https-only/unicast-only checks. (`ctx.proxyAgent` is a separate thing — an undici `Dispatcher` used by pipethrough.)
- ([packages/repo](packages/repo)) — **Every** MST traversal that can visit more than one child of a node (full-tree walks, diffs, block collection) MUST call `node.markVisited(seen)` on each node it enters, with a fresh `CidSet` per traversal. Never add one that skips it. Single-path lookups are exempt. See [packages/repo/AGENTS.md](packages/repo/AGENTS.md).
- ([packages/bsky](packages/bsky)) — read-side service for `app.bsky.*` queries (timelines, profiles, feed generators, hydration pipeline, GraphQL-like view composition). Talks to PDSes via XRPC and to `bsync` via Connect-RPC (protobuf in `packages/bsky/proto`). Runtime entry point in [services/bsky](services/bsky).
  - `app.bsky.feed.getFeed` forwards passthrough headers to a feed generator only when its record's service DID is in `bskyFeedgenDids`; Iris routing overrides do not grant permission.
- ([packages/bsync](packages/bsync)) — internal service for cross-AppView synchronization (mutes, notifications). Connect-RPC interface.
- ([packages/ozone](packages/ozone)) — moderation service for `tools.ozone.*`.
  - Design viewer queries for hundreds of millions of moderation events and tens of millions of reports. Batch hydration, bound returned rows, and check query plans against existing indexes before proposing new ones. Keep viewer projections explicit and test ownership and private-field isolation through the API.
  - Large report-table backfills run in the daemon as bounded primary-key batches. Lock a `job_cursor` row and commit each batch; schema migrations should add nullable columns only. After legacy report writers have rolled off, run `UPDATE job_cursor SET cursor = NULL WHERE job = 'report_reporter_did_backfill'` for a catch-up sweep. Advance past rows with missing or invalid source events and log their counts so they cannot stall the worker.
- ([packages/dev-env](packages/dev-env)) — boots a full PDS + AppView + bsync + plc + ozone constellation in-process for tests and the `make run-dev-env` REPL. Most integration tests in `pds`/`bsky`/`ozone` use it as a fixture builder.

## Conventions

**Code style rules live in [STYLE_GUIDE.md](./STYLE_GUIDE.md)** — imports, typing, dependencies, change scope, and formatting. Read it before writing code. The rest of this section covers repository mechanics only.

- Node ≥22 runtime floor; local nvm users default to Node 24 (`.nvmrc`). CI changeset/build/verify jobs read `devEngines.runtime.version` from `package.json`; tests stay on Node 22 for compatibility, with a security-patched minimum in `.github/workflows/repo.yaml`. Use `node --enable-source-maps` for production-style runs.
- TypeScript compilation uses the native TS7 `tsc` (the standard `typescript` package). There is no per-package `typescript` devDependency — it is hoisted at the root. Note TS7 has no stable programmatic API yet; tools needing one must pin TS6.
- **Every package touched by a change needs a changeset entry.** Add a file under [.changeset/](.changeset/) listing each modified package with an appropriate bump level (pre-v1 breaking changes are `minor` and everything else `patch`, post-v1 `major` for breaking changes, `minor` for new public API, `patch` otherwise). Dependency-only bumps are generated automatically — don't list them by hand. Create that file with `pnpm changeset`.
- Service images are built from the root [Dockerfile](./Dockerfile) with `pnpm deploy`, which copies each workspace dependency according to its `package.json` `files` field. Every service, and every package it depends on, must declare `files` covering everything it loads at runtime (a service's entrypoints included); `verify:package-files` only catches a missing field, not an incomplete one.
- Each service image only builds from the workspace projects that service depends on, devDependencies included. A package that reads another package's files at build time (e.g. `@atproto/bsky`'s codegen reading `@atproto/bsync`'s protos) must declare it as a dependency and read it through `node_modules`.
- **Never buffer an unbounded stream from outside the process.** Decoding or buffering a request/response body that did not originate locally requires an explicit size bound on the _decoded_ bytes — a wire-size cap does not bound a compressed payload. Pass `maxSize` (and a `maxSizeError` for the caller's error type) to `createDecoders` and `pipeline` the result — it bounds every decoding stage, and must be used even when there is no content-encoding (see `packages/xrpc-server/src/util.ts`) — rather than passing a decoded stream straight to `streamToNodeBuffer`.

## Agent files

Agent files — this `AGENTS.md`, the skills under [.agents/skills/](.agents/skills/), and any package-level equivalents — are part of the codebase and must stay in sync with it.

- Keep working plans, handoffs, review reports, query-plan captures, and other session scratch files outside the repository, such as in the workspace directory containing the checkout. Do not add repository ignore rules for them. Never commit them. Before committing, inspect the staged file list for working documents; put only durable project guidance in tracked documentation.

- These files capture **important architectural patterns and conventions** — the non-obvious rules, invariants, and cross-cutting decisions an expert needs that are _not_ evident from reading the code itself. They are not a changelog of behavior, and must not restate anything a reader can infer directly from the code (a route's signature, a function's arguments, what a module exports). Most changes need no update: don't document a new route, metric, migration, or test that simply re-applies an existing pattern. Reach for an edit only when a change establishes, meaningfully alters, or removes such an architectural pattern, and prefer doing it when wrapping up rather than mid-task. If you do, update the file that owns it (repo-wide → this file or [STYLE_GUIDE.md](./STYLE_GUIDE.md); scoped to one package → that package's nested `AGENTS.md`; a workflow an agent follows → the relevant skill), and delete guidance a change makes obsolete in the same pass — stale guidance is worse than none. Reviewers check for drift as a backstop (see [.github/claude-review-prompt.md](.github/claude-review-prompt.md)).
- Keep them **as concise as possible**: only the minimal directives an expert needs. No tutorials, no restating what the code already says.

## Troubleshooting

- **Integration tests run stale service code.** `@atproto/dev-env` loads services through their package exports from `dist`. After changing service code, run `pnpm run build` inside that service package before rerunning its integration tests.
- **Stale codegen.** If the build fails due to a generated file in [packages/api](packages/api) being out of date, run `pnpm run codegen && pnpm run build` from that package, then re-run the build. This is only needed there because its `prebuild` step skips codegen as a performance optimization.
- **Codegen ran but produced stale output.** Codegen relies on `pnpm build:tooling` to build the `@atproto/lex-cli` and `@atproto/lex-builder` packages first. If you see a codegen failure, run `pnpm build:tooling` from the root, then re-run codegen.
- **End-to-end test fails with stale infra.** If docker containers persist across test runs, reset them with `cd packages/dev-infra && docker compose down --volumes`.
- **Nothing else worked.** `make clean` wipes every installed dependency (`node_modules`), build artifact (`dist`, `*.tsbuildinfo`), and prebuild/codegen output across all packages; follow it with `pnpm install && pnpm run build` to restore a clean state.
