---
name: testing
description: Testing practices for this monorepo — choosing between unit and end-to-end tests, where test files live, how tsconfig.test.json fits in, and which test runner (vitest vs jest) to use. Trigger when the user asks to write tests, testing a newly added feature, add coverage, create test files, set up testing in a new package, or mentions vitest/jest/testing.
---

# Testing in this repo

This monorepo uses two test runners. **Vitest is the standard going forward.** Jest is deprecated and only used by packages that haven't been migrated yet — write new jest tests _only_ in packages that already use jest.

For runner-specific patterns and assertions, follow the relevant reference:

- [references/vitest.md](references/vitest.md) — preferred. Patterns for writing vitest tests, plus instructions for adopting vitest in a package that doesn't have tests yet.
- [references/jest.md](references/jest.md) — deprecated. Only for adding cases to existing jest test files or maintaining them until migration.

## Test file location

- **Unit tests** live next to the unit being tested as `foo.ts` + `foo.test.ts`. This is the default — prefer it whenever the test does not need infra, or complex cross-package setup.
- **End-to-end / integration tests** live in a top-level `./tests` folder inside the package (for example, the `pds` and `bsky` packages each have their own `./tests` folder). Use this for tests that boot real services, hit a database, or exercise multiple modules together.

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
