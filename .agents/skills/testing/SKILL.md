---
name: testing
description: >
  Apply this monorepo's testing practices — runner choice (vitest vs jest),
  where test files belong, tsconfig wiring, and the dev-env fixture used by
  integration tests. Use before any code search when asked to add, write, or
  extend tests, add coverage, reproduce a bug with a failing test, choose or
  configure a test runner, decide where a test belongs, run a single test file,
  or test a browser-based user flow. Covers unit, integration, and end-to-end
  tests, and routes UI work to the playwright skill.
disable-model-invocation: false
---

# Testing in this repo

## UI tests: get the assertion strings right first

If the test drives a UI (`packages/pds/tests/{oauth,account-manager}.test.ts`, or anything using the `puppeteer` `PageHelper`), the assertion strings are the whole problem — they are **French** and branch-dependent, so they can't be guessed from the JSX. Read the playwright skill before asserting on any of them: the fastest source is the `fr` message catalog, with a browser walkthrough as the fallback when the rendered branch is unclear.

Full workflow, `PageHelper` API, and dev-env boot instructions: [playwright skill](../playwright/SKILL.md). Come back here for runner and tsconfig questions.

## Choosing a runner

Vitest is the standard and now covers the majority of the repo (~25 packages, ~270 test files) — including `bsky`, all of `packages/lex/*`, `packages/oauth/*`, and the tested `packages/internal/*`. Jest remains in 13 unmigrated packages (~165 files), among them `pds`, `ozone`, `api`, `repo`, and `xrpc-server`. Jest is deprecated: don't introduce it anywhere new, and prefer migrating a file to vitest over deepening its jest usage.

Decide from the package's own config files, not from a memorized list — they are the only drift-proof signal:

1. Package has a `vite.config.*` → **Vitest, configured inside that Vite config** (never a separate `vitest.config.ts`). See [Vite-based packages](references/vitest.md#vite-based-packages).
2. Package has a `vitest.config.ts` → Vitest. See [references/vitest.md](references/vitest.md).
3. Package has a `jest.config.cjs` → Jest. See [references/jest.md](references/jest.md).
4. None of the above → the package has no test setup. Adopt vitest: create `vitest.config.ts` and `tsconfig.test.json` first, following [the setup section](references/vitest.md#adopting-vitest-in-a-new-package), then write the test.

If the test imports `@atproto/lex` or any `@atproto/lex-*` package, also read the [lex-schema skill](../lex-schema/SKILL.md) — schemas expose `$parse` / `$safeParse` / `$matches`, which make better assertions than hand-rolled shape checks.

## Where tests go

- **Unit tests** sit next to their subject: `foo.ts` + `foo.test.ts`. This is the default whenever the test needs no infra and no cross-package setup.
- **Integration / end-to-end tests** go in the package's top-level `./tests` folder (`packages/{pds,bsky,ozone}/tests`, `packages/lex/lex/tests`, …). Use it for tests that boot real services, hit a database, or exercise several modules together.
- **Shared helpers** go in `./tests/_util.ts` (or a `./tests/_util/` directory). The leading underscore keeps them out of glob-based test discovery — see [packages/bsky/tests/\_util.ts](../../../packages/bsky/tests/_util.ts) and [packages/ws-client/tests/\_util/](../../../packages/ws-client/tests/_util).

Jest packages predate the colocation convention and keep everything in `./tests` — `packages/api/src/age-assurance.test.ts` is the lone exception. Don't relocate existing files just to match the convention.

## Integration tests use the dev-env fixture

Almost every integration test in `pds`, `bsky`, `ozone`, and `lexicon-resolver` boots a real service constellation through `@atproto/dev-env` rather than mocking. Reach for it instead of hand-wiring servers:

- `TestNetwork.create({ dbPostgresSchema })` — PDS + AppView + bsync + ozone + PLC. Needs postgres and redis. The schema must be unique per test file: it's the isolation boundary (the AppView and ozone databases are derived from it), so parallel files sharing one corrupt each other's data.
- `TestNetworkNoAppView.create({ pds, plc })` — PDS + PLC only, on a temp-dir store and a mock PLC database. Lighter; use it when the test doesn't touch the AppView. It forwards only the `pds` and `plc` sub-options, so passing a top-level `dbPostgresSchema` here does nothing.
- `network.getSeedClient()` plus a seed exported from `@atproto/dev-env` (`basicSeed`, `usersSeed`, `quotesSeed`, …) populates accounts and records.
- `await network.processAll()` flushes the firehose so the AppView has caught up before you assert.

Tear down with `afterAll(async () => network?.close())` — the prevailing pattern, and the only option for `TestNetworkNoAppView`, which exposes `close()` but no `Symbol.asyncDispose`. Only `TestNetwork` implements it.

Snapshot assertions go through each package's `forSnapshot()` helper in `tests/_util.ts`, which swaps DIDs, CIDs, and timestamps for stable placeholders so snapshots don't churn on every run. Refresh them with `pnpm test:updateSnapshot` (defined in `bsky`, `pds`, `ozone`, `bsync`).

## TypeScript config for tests

Tested packages split their TS config in two, both referenced from the package's `tsconfig.json`:

```json
{
  "include": [],
  "references": [
    { "path": "./tsconfig.build.json" },
    { "path": "./tsconfig.test.json" }
  ]
}
```

- `tsconfig.build.json` — `./src`, excludes `**/*.test.ts`, emits to `./dist`.
- `tsconfig.test.json` — test code, extending `tsconfig/vitest.tsconfig.json` or `tsconfig/jest.tsconfig.json`. Both set `noEmit` and `composite: false`; the jest one additionally pulls in `@types/jest`. `include` is `["./tests", "./src/**/*.test.ts"]` in nearly every package, regardless of runner.

The build is a TS project graph, so `references` is what makes imports resolve. `./tsconfig.build.json` alone covers anything the package already depends on at build time — which is most workspace imports. Add a further entry only for a package the tests import but `src` doesn't: in practice that means `{ "path": "../dev-env/tsconfig.build.json" }`, and only in the six packages with integration tests (`api`, `bsky`, `lexicon-resolver`, `ozone`, `pds`, `sync`).

Create `tsconfig.test.json` before writing the first test in a package that lacks one — `packages/did` has jest tests without one, so don't take its layout as the pattern. Exact contents per runner: [vitest](references/vitest.md#adopting-vitest-in-a-new-package) / [jest](references/jest.md#typescript-config).

## Running tests

Run from inside the package directory:

```bash
pnpm test                        # full package suite
pnpm test path/to/file.test.ts   # single file
```

Packages whose tests need docker infra wrap the runner in a dev-infra script — `bsky`, `pds`, `ozone`, and `sync` use [with-test-redis-and-db.sh](../../../packages/dev-infra/with-test-redis-and-db.sh); `bsync` uses `with-test-db.sh`. Always go through `pnpm test`; invoking `vitest` or `jest` directly skips the script, so postgres and redis aren't running and the suite dies on connection errors. `pds` also offers `pnpm test:sqlite` for a faster loop that skips the docker infra.

From the repo root, `pnpm test` runs every package's suite with infra up, and `pnpm test:unit` runs only the projects registered in [vitest.config.ts](../../../vitest.config.ts). That list is not the full set of vitest packages: `bsky` is commented out because it needs infra, and `lexicon-resolver` is simply absent. Run either from its own directory.

## Code style

- Always use `using` for spies, mocks and any object that implements `Disposable` or `AsyncDisposable`.
