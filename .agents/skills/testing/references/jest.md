# Jest patterns (deprecated)

**Jest is deprecated in this repo.** Vitest is the standard going forward. This reference exists only to:

1. Add cases to existing jest test files in packages that haven't been migrated.
2. Maintain existing jest tests until they are migrated to vitest.

**Do not introduce jest into a package that doesn't already use it.** If you're setting up tests in a fresh package, use vitest — see [vitest.md](vitest.md).

## Identifying a jest package

A package is on jest if it has a `jest.config.cjs` and its `package.json` has `"test": "NODE_OPTIONS=--experimental-vm-modules jest"` (or similar). Examples currently on jest: [packages/api](../../../../packages/api), [packages/pds](../../../../packages/pds), [packages/lexicon](../../../../packages/lexicon), [packages/identity](../../../../packages/identity), [packages/crypto](../../../../packages/crypto), [packages/oauth/oauth-scopes](../../../../packages/oauth/oauth-scopes), and a few others.

The root [jest.config.cjs](../../../../jest.config.cjs) aggregates these via `projects: ['<rootDir>/packages/*/jest.config.cjs']`.

## TypeScript config

Jest packages extend [tsconfig/jest.tsconfig.json](../../../../tsconfig/jest.tsconfig.json), which adds `"types": ["node", "jest"]`. A typical `tsconfig.test.json`:

```jsonc
{
  "extends": ["../../tsconfig/jest.tsconfig.json"],
  "include": ["./tests", "./src/**/*.test.ts"],
  "compilerOptions": {
    "rootDir": ".",
  },
  "references": [
    { "path": "./tsconfig.build.json" },
    // [Add references to any local packages imported from tests]
  ],
}
```

Note: jest packages typically only `include: ["./tests"]` because they don't use colocated `*.test.ts` files. Don't change that — colocation is a vitest-era convention.

## Imports

Jest globals are ambient (provided by `@types/jest`), but several packages also import from `@jest/globals`:

```ts
import { describe, it, expect, jest } from '@jest/globals'
```

Match whatever the existing files in the package do.

## Writing tests

Most of the structural patterns from [vitest.md](vitest.md) apply equally to jest — `describe`/`it`/`expect`, parameterized `it.each`, fixtures at the top of the file, error assertions with `rejects.toThrow()` or `rejects.toMatchObject()`. Differences to watch for:

- Use `jest.fn()` instead of `vi.fn()`. The type-parameter form differs slightly: `jest.fn<ReturnType, ArgsTuple>()` rather than `vi.fn<FnType>()`.
- Use `jest.spyOn()` / `jest.mock()` instead of `vi.spyOn()` / `vi.mock()`.
- `assert()` from vitest has no jest equivalent — for type narrowing, use a plain `if`/`else` guard or `expect(...).toBeInstanceOf(...)` followed by a manual cast. Prefer migrating the file to vitest if narrowing patterns become a recurring need.
- `toSatisfy` is not a jest matcher. Use `toMatchObject`, `toHaveProperty`, or destructure the rejection: `const err = await fn().catch((e) => e); expect(err).toBeInstanceOf(...)`.

## Setup files

Jest packages use the shared root [test.setup.ts](../../../../test.setup.ts) (loads `test.env` via dotenv) and may add a per-package `jest.setup.ts` for matchers (e.g. [packages/api/jest.setup.ts](../../../../packages/api/jest.setup.ts)).

## Running tests

```bash
pnpm test                         # full package suite
pnpm test -- path/to/file.test.ts # single file
```

Some packages require `NODE_OPTIONS=--experimental-vm-modules`, or depend in infrastructure — the `pnpm test` script handles this; avoind invoking jest directly.
