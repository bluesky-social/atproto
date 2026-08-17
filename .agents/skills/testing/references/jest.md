# Jest patterns (deprecated)

Jest (currently v30) is deprecated here; vitest is the standard. This reference covers adding cases to existing jest files and maintaining them until migration. Don't introduce jest into a package that doesn't already have it — for a fresh package, see [vitest.md](vitest.md).

A package is on jest if it has a `jest.config.cjs` and a `"test"` script invoking `jest` with `NODE_OPTIONS=--experimental-vm-modules` (required because the repo is ESM-only). The root [jest.config.cjs](../../../../jest.config.cjs) aggregates them via `projects: ['<rootDir>/packages/*/jest.config.cjs']` — note the single-level glob, so a jest package nested under `packages/lex/` or `packages/oauth/` would not be picked up. Check the package's own config rather than trusting any list.

## TypeScript config

Jest packages extend [tsconfig/jest.tsconfig.json](../../../../tsconfig/jest.tsconfig.json), which adds `"types": ["node", "jest"]` on top of the shared node config:

```jsonc
{
  "extends": ["../../tsconfig/jest.tsconfig.json"],
  "include": ["./tests", "./src/**/*.test.ts"],
  "compilerOptions": {
    "rootDir": ".",
  },
  "references": [
    { "path": "./tsconfig.build.json" },
    // Integration tests only — see below
    { "path": "../dev-env/tsconfig.build.json" },
  ],
}
```

`./tsconfig.build.json` covers the package's own build-time deps and is all most jest packages have. Of the 13, only `api`, `ozone`, `pds`, and `sync` add the `dev-env` entry, because their tests import `@atproto/dev-env` while `src` doesn't. `packages/did` has jest tests but no `tsconfig.test.json` at all — a gap, not a pattern.

The `include` glob covers colocated `src/**/*.test.ts` even though jest packages barely use them (`packages/api/src/age-assurance.test.ts` is the only one) — leave it as-is so the two runners' configs stay uniform. A package adding custom matchers also needs them declared: [packages/api](../../../../packages/api/tsconfig.test.json) sets `"types": ["jest", "./jest.d.ts"]` to pick up its ambient `jest.d.ts`.

## Writing tests

Most structural conventions from [vitest.md](vitest.md) carry over — `describe`/`it`, `it.each`, fixtures at the top of the file, `using` for spies (jest 30's spies are `Disposable` too). What differs:

| vitest                   | jest                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `vi.fn<FnType>()`        | `jest.fn<FnType>()` (single type param since jest 30)                                                                             |
| `vi.spyOn` / `vi.mock`   | `jest.spyOn` / `jest.mock`                                                                                                        |
| `assert()` from `vitest` | `import assert from 'node:assert'` — the prevailing pattern in `pds` tests                                                        |
| `rejects.toSatisfy(cb)`  | not a jest matcher; use `rejects.toMatchObject({ error: '…' })`, or `const err = await fn().catch((e) => e)` then assert on `err` |
| `expectTypeOf`           | no equivalent; skip type-level assertions or migrate the file                                                                     |

Jest globals are ambient via `@types/jest`, but a minority of files import them explicitly from `@jest/globals`. Match whatever the surrounding files in the package do rather than mixing styles within one package.

## Setup files

Transpilation is `@swc/jest`, not `ts-jest`, with a `moduleNameMapper` that resolves the repo's explicit `.js` import extensions back to `.ts` sources.

## Running tests

See [Running tests in SKILL.md](../SKILL.md#running-tests). Jest does accept a path after `--`, but omitting `--` works in both runners — so just use `pnpm test path/to/file.test.ts` and the habit stays correct when the file migrates.
