---
name: testing
description: >
  Apply this monorepo's testing practices — vitest configuration, where test
  files belong, tsconfig wiring, and the dev-env fixture used by
  integration tests. Use before any code search when asked to add, write, or
  extend tests, add coverage, reproduce a bug with a failing test, configure
  the test runner, decide where a test belongs, run a single test file,
  or test a browser-based user flow. Covers unit, integration, and end-to-end
  tests, and routes UI work to the playwright skill.
disable-model-invocation: false
---

# Testing in this repo

## UI tests: get the assertion strings right first

If the test drives a UI (`packages/pds/tests/{oauth,account-manager}.test.ts`, or anything using the `puppeteer` `PageHelper`), the assertion strings are the whole problem — they are **French** and branch-dependent, so they can't be guessed from the JSX. Read the playwright skill before asserting on any of them: the fastest source is the `fr` message catalog, with a browser walkthrough as the fallback when the rendered branch is unclear.

Full workflow, `PageHelper` API, and dev-env boot instructions: [playwright skill](../playwright/SKILL.md). Come back here for runner and tsconfig questions.

## Configuring the runner

Every tested package runs vitest. Where its config lives depends on the package's own files:

1. Package has a `vite.config.*` → **Vitest, configured inside that Vite config** (never a separate `vitest.config.ts`). See [Vite-based packages](references/vitest.md#vite-based-packages).
2. Package has a `vitest.config.ts` → Vitest. See [references/vitest.md](references/vitest.md).
3. None of the above → the package has no test setup. Adopt vitest: create `vitest.config.ts` and `tsconfig.test.json` first, following [the setup section](references/vitest.md#adopting-vitest-in-a-new-package), then write the test.

If the test imports `@atproto/lex` or any `@atproto/lex-*` package, also read the [lex-schema skill](../lex-schema/SKILL.md) — schemas expose `$parse` / `$safeParse` / `$matches`, which make better assertions than hand-rolled shape checks.

## Where tests go

A test lives in the package whose behavior it checks, at the smallest scope that exercises it.

- **Unit tests** sit next to their subject: `foo.ts` + `foo.test.ts`, with collaborators stubbed (`vi.fn`, a fake `fetch`, an in-memory store). This is the default, in older packages too: a unit-level test still sitting in `./tests` (no service, no database) moves next to its subject. A test that imports `@atproto/dev-env`, even for a fixture like `assetPath`, stays in `./tests`.
- **Broader tests**, exercising several modules together, go in the package's top-level `./tests` folder. They still stub whatever isn't under test; only the service packages' suites (`pds`, `bsky`, `ozone`, `bsync`) boot real services or a database.
- **A backend's behavior is tested in the backend.** A client package (`api`, `lex-client`, …) checks how it builds requests and handles responses, against a stub; what a PDS or AppView answers belongs in `pds` or `bsky`.
- **Shared helpers** go in `./tests/_util.ts` (or a `./tests/_util/` directory). The leading underscore keeps them out of glob-based test discovery — see [packages/bsky/tests/\_util.ts](../../../packages/bsky/tests/_util.ts) and [packages/ws-client/tests/\_util/](../../../packages/ws-client/tests/_util). A helper for colocated `src` tests sits next to them as `_<name>.test.ts` (e.g. [packages/sync/src/firehose/\_stub-pds.test.ts](../../../packages/sync/src/firehose/_stub-pds.test.ts)): the `.test.ts` suffix keeps it out of `dist` and under the test tsconfig and lint rules, and the package's vitest config adds `'**/_*.test.ts'` to `exclude` (after `...configDefaults.exclude`) so it isn't collected as a test file.

### Stubbing a server

Prefer stubbing per test, with no server: most clients take a `fetch` or fetch handler, so build one in the test that answers just the calls it makes and records what the client sent, then assert on both. [packages/api/src/\_xrpc-fetch.test.ts](../../../packages/api/src/_xrpc-fetch.test.ts) builds such a `fetch` from a per-test map of XRPC handlers. Keep state out of shared stubs: when a test needs read-after-write, give it its own small store. When a test needs an actual XRPC server (routing, input validation), register handlers on an `@atproto/lex-server` `LexRouter` and pass `router.fetch` (a `(Request) => Promise<Response>`) as the client's `fetch`: it runs in-process, with no port. Use `serve()` from `@atproto/lex-server/nodejs` only when the code under test opens its own connection (a websocket, a URL handed to another process).

### Waiting on servers and sockets

Wait for an event with `await once(emitter, 'listening')` from `node:events`, never `new Promise((r) => emitter.once('listening', r))`: `once` rejects on `'error'`, while the hand-rolled promise never settles (a taken port becomes a hook timeout, or a worker that never exits). Reject on `close()` errors too, give every polling loop a deadline, and close what a half-failed `beforeAll` opened (`await using`, `x?.close()`).

## Integration tests use the dev-env fixture

Integration tests in `pds`, `bsky` and `ozone` that need a real service constellation boot it through `@atproto/dev-env` rather than hand-wiring servers. Reach for it only when a stub can't do: a stub runs without infra and is faster. It resolves from the repo root in every package, so eslint is what keeps it out of colocated `src/**/*.test.ts` files and out of `@atproto/api` (which dev-env depends on).

- `TestNetwork.create({ dbPostgresSchema })` — PDS + AppView + bsync + ozone + PLC. Needs postgres and redis. The schema must be unique per test file: it's the isolation boundary (the AppView and ozone databases are derived from it), so parallel files sharing one corrupt each other's data.
- `TestNetworkNoAppView.create({ pds, plc })` — PDS + PLC only, on a temp-dir store and a mock PLC database. Lighter; use it when the test doesn't touch the AppView. It forwards only the `pds` and `plc` sub-options, so passing a top-level `dbPostgresSchema` here does nothing.
- `TestPds.create(config, overrides)` — a lone PDS; pair with `TestPlc.create({})` and set `didPlcUrl: plc.url`. The optional second argument is passed to `PDS.create` as `AppContext` overrides (e.g. `{ plcRotationKey }`); neither network class forwards it.
- `network.getSeedClient()` plus a seed exported from `@atproto/dev-env` (`basicSeed`, `usersSeed`, `quotesSeed`, …) populates accounts and records.
- `await network.processAll()` flushes the firehose so the AppView has caught up before you assert.

Tear down with `afterAll(async () => network?.close())` — the prevailing pattern, and the only option for `TestNetworkNoAppView`, which exposes `close()` but no `Symbol.asyncDispose`. Only `TestNetwork` implements it.

A test that resolves identities (handles, `did:plc`, `did:web`) against localhost must construct its resolver with `fetch: globalThis.fetch` — `@atproto/identity`'s default fetch is SSRF-protected and refuses localhost/private-IP targets silently.

Snapshot assertions go through each package's `forSnapshot()` helper in `tests/_util.ts`, which swaps DIDs, CIDs, and timestamps for stable placeholders so snapshots don't churn on every run. Refresh them with `pnpm test:updateSnapshot` (defined in `bsky`, `pds`, `ozone`, `bsync`).

## TypeScript config for tests

Tested packages split their TS config, each part referenced from the package's `tsconfig.json`:

```json
{
  "include": [],
  "references": [
    { "path": "./tsconfig.config.json" },
    { "path": "./tsconfig.build.json" },
    { "path": "./tsconfig.test.json" }
  ]
}
```

- `tsconfig.build.json` — `./src`, excludes `**/*.test.ts`, emits to `./dist`.
- `tsconfig.test.json` — test code, extending `tsconfig/vitest.tsconfig.json` (`noEmit`, `composite: false`). `include` is `["./tests", "./src/**/*.test.ts"]` in nearly every package.
- `tsconfig.config.json` — root-level config/script files (`vitest.config.ts`, …) that neither of the above covers, extending [tsconfig/config.tsconfig.json](../../../tsconfig/config.tsconfig.json) with `include: ["./*.ts", "./*.js", "./*.cjs", "./*.mjs"]`. `exclude` any root file that imports `./src` or `./tests` (e.g. a `vitest.setup.ts`), or it drags the whole tree into this stricter program. Present whenever the package has such a file — which is nearly all of them.

The build is a TS project graph, so `references` is what makes imports resolve. `./tsconfig.build.json` alone covers anything the package already depends on at build time — which is most workspace imports. Add a further entry only for a package the tests import but `src` doesn't: in practice that means `{ "path": "../dev-env/tsconfig.build.json" }`, and only in the service packages whose integration tests boot it (`bsky`, `ozone`, `pds`).

Create `tsconfig.test.json` before writing the first test in a package that lacks one. Exact contents: [references/vitest.md](references/vitest.md#adopting-vitest-in-a-new-package).

## Running tests

Run from inside the package directory:

```bash
pnpm test                        # full package suite
pnpm test path/to/file.test.ts   # single file
```

Packages whose tests need docker infra wrap the runner in a dev-infra script — `bsky`, `pds`, and `ozone` use [with-test-redis-and-db.sh](../../../packages/dev-infra/with-test-redis-and-db.sh); `bsync` uses `with-test-db.sh`. Always go through `pnpm test`; invoking `vitest` directly skips the script, so postgres and redis aren't running and the suite dies on connection errors. `pds` also offers `pnpm test:sqlite` for a faster loop that skips the docker infra.

From the repo root, `pnpm test` runs every package's suite with infra up. CI splits the same suites into two disjoint sets: `pnpm test:unit` runs the projects registered in [vitest.config.ts](../../../vitest.config.ts) without infra, and `pnpm test:integration` runs the dev-infra packages registered in [vitest.integration.config.ts](../../../vitest.integration.config.ts) in a single vitest process, so each CI shard spreads every package's files over the same workers. A new tested package must join one of the two configs, or CI never runs it.

## Logs

Every part of the code base uses pino logging, which is disabled by default. Enable it with `LOG_ENABLED=true` and redirect to a file with `LOG_DESTINATION=...`. For example, to run the full test suite and capture logs:

```bash
LOG_ENABLED=true LOG_DESTINATION=test.log pnpm test ...
```

Pretty print using:

```bash
cat test.log | pnpm exec pino-pretty
```

## Code style

- Always use `using` for spies, mocks and any object that implements `Disposable` or `AsyncDisposable`.
