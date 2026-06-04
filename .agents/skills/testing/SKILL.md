---
name: testing
description: Testing practices for this monorepo — choosing between unit and end-to-end tests, where test files live, how tsconfig.test.json fits in, how to use playwright to test UI interactions, and which test runner (vitest vs jest) to use. Trigger when the user asks to write tests, testing a newly added feature, add coverage, create test files, set up testing in a new package, or mentions vitest/jest/testing.
---

# Testing in this repo

This monorepo uses two test runners. **Vitest is the standard going forward.** Jest is deprecated and only used by packages that haven't been migrated yet — write new jest tests _only_ in packages that already use jest.

Decide which runner to use by following these steps in order:

1. Does the package directory contain `vitest.config.ts`? → use Vitest, follow [references/vitest.md](references/vitest.md).
2. Does the package directory contain `jest.config.cjs`? → use Jest, follow [references/jest.md](references/jest.md).
3. Neither exists? → the package has no tests yet. Adopt Vitest: before writing any test code, create `vitest.config.ts` and `tsconfig.tests.json` by following the setup section of [references/vitest.md](references/vitest.md), then write the test.
4. Does the test code import `@atproto/lex` (or sub-packages)? → also consult the [lex-sdk skill](../lex-sdk/SKILL.md) — schemas have validation helpers (`$parse`, `$safeParse`, `$matches`) that are useful in assertions.

Runner-reference summary:

- [references/vitest.md](references/vitest.md) — preferred. Patterns for writing vitest tests, plus setup instructions for adopting vitest in a package that doesn't have tests yet.
- [references/jest.md](references/jest.md) — deprecated. Only for adding cases to existing jest test files or maintaining them until migration.
- [references/playwright.md](references/playwright.md) — for tests that interact with the UI, use Playwright with the patterns in this reference (in combination with [references/jest.md](references/jest.md) as all UI test are currently jest based, ask the user to update this skill if that is no longer the case).

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
