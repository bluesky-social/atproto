# Vitest patterns

Repo-specific conventions and setup. Assumes working knowledge of vitest itself (currently v4) — only the things this codebase does differently from the defaults are documented here.

## Adopting vitest in a new package

1. Add `vitest` to `devDependencies` and set `"test": "vitest run"` in `package.json`.
2. Create `vitest.config.ts` in the package root. Nearly every package in the repo has exactly this and nothing more:

   ```ts
   import { defineProject } from 'vitest/config'

   export default defineProject({
     test: {},
   })
   ```

   `defineProject` (not `defineConfig`) is what makes the package composable into the root workspace runner. Add `setupFiles`, `testTimeout`, `resolve.alias`, etc. only when the package actually needs them — [packages/bsky](../../../../packages/bsky/vitest.config.ts) and [packages/ws-client](../../../../packages/ws-client/vitest.config.ts) are the only two that do.

   **Exception:** if the package already has a `vite.config.*`, don't create `vitest.config.ts` — see [Vite-based packages](#vite-based-packages).

3. Register the package in the root [vitest.config.ts](../../../../vitest.config.ts) under `test.projects` so `pnpm test:unit` and the VSCode Vitest extension pick it up. Several entries are globs (`packages/lex/*`, `packages/oauth/*`, `packages/internal/*`), so a package placed under one of those directories needs no edit.

   **Skip this step if the tests need dev-infra** (the postgres + redis docker stack). The workspace runner doesn't start dev-infra, so those tests would fail when invoked from the root. That's why `packages/bsky` is commented out of the list — it must run from its own directory via `pnpm test`, which goes through [with-test-redis-and-db.sh](../../../../packages/dev-infra/with-test-redis-and-db.sh). `packages/lexicon-resolver` is also missing from the list, but without a comment and without a dev-infra wrapper on its `test` script, so treat its absence as an oversight rather than a pattern to copy.

4. Create `tsconfig.test.json` extending the shared vitest config (never the jest one, which pulls in `@types/jest`):

   ```json
   {
     "extends": ["../../tsconfig/vitest.tsconfig.json"],
     "include": ["./tests", "./src/**/*.test.ts"],
     "compilerOptions": {
       "rootDir": "."
     },
     "references": [{ "path": "./tsconfig.build.json" }]
   }
   ```

   Adjust the `../../` depth for nested packages (`packages/lex/*` and `packages/oauth/*` need `../../../`). `./tsconfig.build.json` is normally the only reference needed — it already pulls in the package's build-time deps, so a test importing `@atproto/lex-data` from `lex-json` resolves without an extra entry. Add one only for a package the tests import but `src` doesn't; that's `{ "path": "../dev-env/tsconfig.build.json" }` in the integration-test packages, and little else.

   Extend `include` for other test-only sources: benchmarks (`./src/**/*.bench.ts`, as [lex-json](../../../../packages/lex/lex-json/tsconfig.test.json) does) or ambient declarations (`./src/core-js.d.ts`, as [lex-document](../../../../packages/lex/lex-document/tsconfig.test.json) does).

5. Make sure the package's `tsconfig.json` references both `./tsconfig.build.json` and `./tsconfig.test.json`.

## Vite-based packages

A package with a `vite.config.*` must use vitest, configured **inside that existing Vite config**. Vitest reads `vite.config.*` natively, so a separate `vitest.config.ts` would shadow the package's real build setup (plugins, `resolve.alias`, `optimizeDeps`, `conditions`) and the tests would run against a different module graph than the app. Jest isn't an option at all here — it can't consume the Vite plugin pipeline.

Two additions to the Vite config, as in [oauth-provider-ui](../../../../packages/oauth/oauth-provider-ui/vite.config.js):

1. `/// <reference types="vitest/config" />` on the **first line** — this types the `test` key, which `defineConfig` from `vite` doesn't know about on its own.
2. A `test: {}` key in the exported config, kept empty unless an option is genuinely needed.

Everything else is unchanged: `vitest` in `devDependencies`, `"test": "vitest run"`, root `projects` registration, and a `tsconfig.test.json`.

Because the tests share the app's Vite config, they inherit its `resolve.alias` — import through the package's own aliases (`#/lib/foo.js`) exactly as production code does, rather than reaching for brittle relative paths.

## Imports

Import test utilities by name from `vitest`; nothing is ambient:

```ts
import { assert, describe, expect, it, vi } from 'vitest'
```

Prefer vitest's `assert` over `node:assert` — it narrows types and reports through vitest's error formatting.

## Labels

`it` and `test` are aliases at runtime, but this repo picks between them by what the label _is_:

- **`it('<description>', …)`** when the label is a sentence describing behavior. Reads as "it rejects invalid request bodies".
- **`test(case, …)`** when the label identifies a specific case: a function reference, a fixture name, a parameterized row. Reads as "test `parseCid`".

For `describe`, pass the function or class **reference** rather than a string when the suite covers a single named export — the label stays correct through renames:

```ts
describe(parseCid, () => { … })
describe(XrpcResponseError, () => { … })
```

Use a string label for conceptual groups that don't map to one export — an arrow function assigned to a const, a class method, a roundtrip pair (`describe('roundtrip toBase64 <-> fromBase64', …)`). Integration suites under `./tests` span many endpoints and are string-labeled by convention: `describe('pds profile views', …)`.

## Parameterized tests

Prefer `test.each` over a hand-rolled `for` loop. Each row is a case identifier, hence `test` and not `it`:

```ts
describe(isReconnectableClose, () => {
  test.each([
    { note: 'normal shutdown', code: CloseCode.Normal, expected: false },
    { note: 'internal error', code: CloseCode.InternalError, expected: true },
  ])('$note', ({ code, expected }) => {
    expect(isReconnectableClose(code)).toBe(expected)
  })
})
```

The label template is `'$note'` — `$`-prefixed, referring to a property of the row object. `'{note}'` does _not_ interpolate; it renders literally, so every case ends up with the same name.

To run one suite against several implementations of an interface, the implementation is the case identifier, so `describe.each` takes it — but the inner labels still describe behavior, so they stay `it`:

```ts
describe.each([utf8LenNode, utf8LenCompute])('%o', (utf8Len) => {
  // some implementations are runtime-optional; assert before the tests read them
  assert(utf8Len, 'utf8Len implementation should not be null')

  it('computes utf8 string length', () => {
    expect(utf8Len('a')).toBe(1)
  })
})
```

Fall back to `for (const c of cases) { test(c.name, …) }` only when the body shape genuinely can't be expressed as `test.each` — different nesting or a different number of assertions per case.

### Fixture files

Import JSON fixtures with the import attribute and hand the array straight to `test.each`, keyed on a label property:

```ts
import fixtures from './data-model-valid.json' with { type: 'json' }

test.each(fixtures)('$note', (fixture) => { … })
```

For the shared text fixtures in `interop-test-files/`, use the existing [`readInteropFile`](../../../../packages/syntax/tests/_utils.ts) helper rather than re-implementing the read-and-filter logic:

```ts
test.each(readInteropFile('aturi_syntax_valid.txt'))('%s', (value) => { … })
```

## Assertions

### `assert` for narrowing

`assert()` narrows types; `expect(…).toBe(true)` does not. Preferring it means the rest of the test can read narrowed properties without a second guard or a cast:

```ts
assert(result.success)
expect(result.body).toEqual({ value: 'hello' }) // result.body is typed here
```

The same applies to instance checks before property assertions:

```ts
assert(err instanceof XrpcFetchError)
expect(err.cause).toBeInstanceOf(TypeError)
```

`expect(result).toMatchObject({ success: true })` is the worst of the three — no narrowing, and a weaker diagnostic on failure.

### Rejections

- `rejects.toThrow()` — the only assertion is that something threw.
- `rejects.toThrow(message)` — the only assertion beyond that is the message, as a string or regex.
- `rejects.toSatisfy(…)` — everything else, including checking exactly one non-message property (`err.cause`, `err instanceof X`, `err.code`).

Inside a `toSatisfy` callback, a failing `expect()` or `assert()` propagates as the test failure, so the assertions read normally and no try/catch is needed. The callback has to `return true` at the end — that line is only reached when everything passed:

```ts
await expect(someAsyncFn()).rejects.toSatisfy((err) => {
  assert(err instanceof SomeError)
  expect(err.cause).toBeInstanceOf(TypeError)
  return true
})
```

### Type-level assertions

Use `expectTypeOf` rather than a hand-rolled `const expectType = <T>(_: T) => {}` helper — it compiles to nothing, so it's free at runtime. This repo uses `toEqualTypeOf` for exact matches and `toMatchObjectType` for partial ones. Avoid `toMatchTypeOf`, which upstream deprecated in favor of those two.

```ts
expectTypeOf(result.body).toEqualTypeOf<{ blobRef: l.BlobRef }>()
expectTypeOf(response.body).toMatchObjectType<{ cursor?: string }>()
```

For deliberately invalid arguments, `// @ts-expect-error` with a reason:

```ts
// @ts-expect-error intentionally passing invalid params
params: { limit: 'not-a-number' },
```

## Mocks and spies

Type `vi.fn` with the function type when the test inspects how it was called:

```ts
const fetchHandler = vi.fn<FetchHandler>(async () =>
  Response.json({ value: 'ok' }),
)

await xrpc(fetchHandler, testQuery, { params: { limit: 25 } })

expect(fetchHandler).toHaveBeenCalledOnce()
const [path] = fetchHandler.mock.calls[0]
expect(path).toContain('/xrpc/io.example.testQuery')
```

When calls don't need inspecting, a plain typed function is clearer than a mock: `const fetchHandler: FetchHandler = async () => …`.

### Module mocks

Mocking a node built-in usually needs both the default and the named exports, since callers may use either form ([lexicon-resolver](../../../../packages/lexicon-resolver/tests/lexicon.test.ts) does this for DNS):

```ts
vi.mock('node:dns/promises', () => {
  const mock = { resolveTxt: vi.fn() }
  return { default: mock, ...mock }
})
```

To override only part of a module, spread the actual one:

```ts
vi.mock('./const.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('./const.js')
  return { ...actual, KWS_V2_COUNTRIES: new Set(['AA']) }
})
```

Note that `bsky` integration tests mock the **compiled** path (`../../dist/api/…`), not `../../src/…`, because the service under test is loaded from `dist`. Match whatever the module graph actually resolves, or the mock silently won't apply.

## Running tests

See [Running tests in SKILL.md](../SKILL.md#running-tests) — in particular, don't put `--` before a file path.
