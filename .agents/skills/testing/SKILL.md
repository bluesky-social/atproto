---
name: testing
description: >
  Testing practices for this monorepo — choosing between unit and end-to-end tests, where test files live, how tsconfig.test.json fits in, how to drive Playwright, to to write/adapt UI/end-to-end tests, and which test runner (vitest vs jest) to use. MUST be invoked BEFORE any code search or file reads whenever the user asks to add, write, or extend a test, add coverage, create a test file, set up testing in a new package, mentions vitest/jest, or refers to an existing `*.test.ts` file. Applies equally to unit tests and to end-to-end / UI tests — the skill routes to a Playwright-MCP-first discovery flow for the latter, which differs from normal code-search workflow.
disable-model-invocation: false
---

# Testing in this repo

## End-to-end UI tests: Playwright MCP first

If the test you're about to write drives a UI (anything in `packages/pds/tests/{oauth,account-manager}.test.ts`, or any test that boots a browser via `puppeteer` / Playwright), STOP before grepping or reading source.

**Discover the flow by driving the running app through the Playwright MCP**, not by reading the implementation. Boot the dev env (`cd packages/dev-env && pnpm dev`, PDS at http://localhost:2583), then use `browser_navigate` / `browser_click` / `browser_snapshot` to walk the user flow yourself and copy the exact visible strings out of the snapshot. This catches what the user actually sees — including i18n strings, conditional UI, and edge cases that source-reading misses.

Reading code is the fallback only when Playwright MCP can't reach the state (e.g. the feature isn't wired up yet). See the [playwright skill](../playwright/SKILL.md) for the full workflow and `PageHelper` API.

## Test runner

This monorepo uses two test runners. **Vitest is the standard going forward.** Jest is deprecated and only used by packages that haven't been migrated yet — write new jest tests _only_ in packages that already use jest, and migrate to vitest when feasible.

Currently on vitest (per the root [vitest.config.ts](../../../vitest.config.ts) `projects` list): `bsky`, `lex/*`, `syntax`, `tap`, plus a growing list. Most other packages — including `pds` — are still on jest, aggregated by the root [jest.config.cjs](../../../jest.config.cjs).

Decide which runner to use by following these steps in order:

1. Does the package directory contain `vitest.config.ts`? → use Vitest, follow [references/vitest.md](references/vitest.md).
2. Does the package directory contain `jest.config.cjs`? → use Jest, follow [references/jest.md](references/jest.md).
3. Neither exists? → the package has no tests yet. Adopt Vitest: before writing any test code, create `vitest.config.ts` and `tsconfig.tests.json` by following the setup section of [references/vitest.md](references/vitest.md), then write the test.
4. Does the test code import `@atproto/lex` (or any `@atproto/lex-*` sub-packages)? → also consult the [lex-sdk skill](../lex-sdk/SKILL.md) — schemas have validation helpers (`$parse`, `$safeParse`, `$matches`) that are useful in assertions.

Runner-reference summary:

- [references/vitest.md](references/vitest.md) — preferred. Patterns for writing vitest tests, plus setup instructions for adopting vitest in a package that doesn't have tests yet.
- [references/jest.md](references/jest.md) — deprecated. Only for adding cases to existing jest test files or maintaining them until migration. UI tests in `pds` are currently jest-based; combine this reference with the [playwright skill](../playwright/SKILL.md) when extending them.

## Test file location

- **Unit tests** live next to the unit being tested as `foo.ts` + `foo.test.ts`. This is the default — prefer it whenever the test does not need infra, or complex cross-package setup.
- **End-to-end / integration tests** live in a top-level `./tests` folder inside the package (for example, the `pds` and `bsky` packages each have their own `./tests` folder). Use this for tests that boot real services, hit a database, or exercise multiple modules together.
- **Shared test helpers** live in `./tests/_util.ts` (or `./tests/_util/*`). The leading underscore keeps them out of glob-based test discovery. Used by [packages/bsky/tests/\_util.ts](../../../packages/bsky/tests/_util.ts) and [packages/tap/tests/\_util.ts](../../../packages/tap/tests/_util.ts).

## TypeScript config for tests

Each package splits its TS config into three files referenced from the root `tsconfig.json`:

```json
{
  "include": [],
  "references": [
    { "path": "./tsconfig.build.json" },
    { "path": "./tsconfig.tests.json" }
  ]
}
```

- `tsconfig.build.json` — production code in `./src`, excludes `**/*.test.ts`, emits to `./dist`.
- `tsconfig.tests.json` — test code. For vitest packages it extends `../../tsconfig/vitest.json`; for jest packages it extends `../../tsconfig/tests.json` (which adds `"types": ["node", "jest"]`). The `include` list typically covers both `./tests` and `./src/**/*.test.ts`.

When adding tests to a package that doesn't already have a `tsconfig.tests.json`, create one before writing tests. See the runner-specific reference for the exact contents.

## Running tests

From a package directory:

```bash
pnpm test                         # full suite (vitest run / jest)
pnpm test -- path/to/file.test.ts # single file
```

For packages whose tests need postgres + redis (`bsky`, `pds`, `ozone`), always go through `pnpm test` — the `test` script wraps invocations in [packages/dev-infra/with-test-redis-and-db.sh](../../../packages/dev-infra/with-test-redis-and-db.sh). Calling `pnpm exec vitest run` (or `jest`) directly will fail because the infra isn't started. These packages are intentionally absent from the root [vitest.config.ts](../../../vitest.config.ts) `projects` list for the same reason.
