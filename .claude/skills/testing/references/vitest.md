# Vitest patterns

Conventions for writing vitest tests in this codebase, plus the steps for adopting vitest in a package that doesn't yet have it.

## Adopting vitest in a new package

When a package doesn't yet have vitest set up:

1. Add `vitest` to `devDependencies` and set `"test": "vitest run"` in `package.json`.
2. Create `packages/<scope>/<pkg>/vitest.config.ts`. Most packages need only:

   ```ts
   import { defineProject } from 'vitest/config'

   export default defineProject({
     test: {},
   })
   ```

   Set `setupFiles`, `testTimeout`, `exclude`, etc. only when the package needs them.

3. Register the package in the root [vitest.config.ts](../../../../vitest.config.ts) under `test.projects` so the workspace-level runner picks it up:

   ```ts
   projects: [
     'packages/lex/*',
     'packages/syntax',
     'packages/tap',
     'packages/<your-package>', // add here
   ],
   ```

   **Do not add the package to the root `projects` list if its tests depend on dev-infra** (postgres + redis docker stack). The workspace-level runner does not start dev-infra, so those tests would fail when invoked from the root. This is why `packages/bsky` is intentionally omitted from the root config — it must be run from its own directory via `pnpm test`, which goes through [packages/dev-infra/with-test-redis-and-db.sh](../../../../packages/dev-infra/with-test-redis-and-db.sh). See the comment in [vitest.config.ts](../../../../vitest.config.ts) for context.

4. Create `tsconfig.tests.json` extending the shared vitest config. Always extend `../../tsconfig/vitest.json` (the jest-typed `../../tsconfig/tests.json` pulls in `@types/jest` and is for jest packages only):

   ```json
   {
     "extends": "../../tsconfig/vitest.json",
     "include": ["./tests", "./src/**/*.test.ts"],
     "compilerOptions": {
       "rootDir": ".",
       "noUnusedLocals": false
     }
   }
   ```

   The shared [tsconfig/vitest.json](../../../../tsconfig/vitest.json) supplies `lib`, `module`, and `noEmit`. Make sure the package's root `tsconfig.json` references both `./tsconfig.build.json` and `./tsconfig.tests.json`.

   Extend `include` for any additional test-only sources the package has — benchmarks (`./src/**/*.bench.ts`), ambient declarations (`./src/core-js.d.ts`), etc.

## Imports

Always import test utilities from `vitest` using named imports:

```ts
import { assert, describe, expect, it, vi } from 'vitest'
```

Pick between `it` and `test` based on what the label is:

- **`it('<description>', ...)`** — use when the label is a sentence describing behavior. Reads as "it <description>". Example: `it('rejects invalid request bodies', ...)`.
- **`test(implementation, ...)`** / **`test.each(cases)(...)`** — use when the label is a specific case identifier: a function reference, a fixture name, a parameterized case. Reads as "test <case>". Example: `test(parseCid, ...)`, `test.each(fixtures)('%s', ...)`.

For `assert`, prefer vitest's named import over `node:assert`.

## Test structure

### Describe labels

Pass the function/class reference as the describe label when the export is a named function or class. Use a string label when testing an arrow function assigned to a variable, a class method, or multiple related behaviors that don't map to a single export:

```ts
// Function or class reference as label (preferred when testing a single export)
describe(parseCid, () => { ... })
describe(isLexValue, () => { ... })
describe(XrpcResponseError, () => { ... })

// String label for conceptual groups or when testing multiple related behaviors
describe('roundtrip toBase64 <-> fromBase64', () => { ... })
```

**Integration tests are an exception.** End-to-end suites under a package's `./tests` folder typically span many endpoints and don't map to a single export — string labels are the norm there:

```ts
describe('pds profile views', () => { ... })
```

### Grouping

Nest logical groupings inside the top-level describe:

```ts
describe(someFunction, () => {
  describe('valid inputs', () => { ... })
  describe('invalid inputs', () => { ... })
  describe('edge cases', () => { ... })
})
```

For features with a default behavior and an override, cover both:

```ts
describe(validateResponse, () => {
  it('rejects invalid response body by default', ...)
  it('accepts invalid response body when disabled', ...)
  it('succeeds with valid response body when enabled', ...)
})
```

For code that handles unbounded inputs, recursion, or untrusted data (parsers, validators, serializers), include safety and edge case tests:

```ts
it('handles cyclic structures without infinite loops', () => { ... })
it('handles deep structures without exceeding call stack', () => { ... })
```

## Parameterized tests

Use `test.each` over test case arrays — each row is a specific case, not a behavior description:

```ts
describe(isLexScalar, () => {
  test.each([
    { note: 'string', value: 'hello', expected: true },
    { note: 'number (int)', value: 42, expected: true },
    { note: 'null', value: null, expected: true },
    { note: 'number (float)', value: 3.14, expected: false },
    { note: 'undefined', value: undefined, expected: false },
  ])('{note}', ({ value, expected }) => {
    expect(isLexScalar(value)).toBe(expected)
  })
})
```

This also works for running the same test suite against multiple implementations. The outer `describe.each` parameterizes the suite by implementation; the inner labels stay as `it('<description>', ...)` because they describe behavior:

```ts
describe.each([utf8LenNode, utf8LenCompute] as const)('%o', (utf8Len) => {
  // if some implementations are optional, assert they exist before running tests
  assert(utf8Len)

  it('computes utf8 string length', () => {
    expect(utf8Len('a')).toBe(1)
  })
})
```

## Assertions

### Type narrowing with `assert`

Use `assert()` from vitest for type narrowing and boolean checks. **Always prefer `assert(result.success)` over `expect(result.success).toBe(true)`** — `assert` provides type narrowing in TypeScript, which lets the rest of the test access narrowed properties without additional type guards.

```ts
// Narrow to a specific type before further assertions
assert(err instanceof XrpcFetchError)
expect(err.cause).toBeInstanceOf(TypeError)

// Discriminated union checks - PREFERRED
assert(result.success)
expect(result.body).toEqual({ value: 'hello' })
// TypeScript now knows result.body exists

assert(!result.success)
expect(result).toBeInstanceOf(XrpcResponseError)
// TypeScript now knows result has error properties

// DON'T do this - it doesn't narrow types
expect(result.success).toBe(true) // ❌ No type narrowing
if (result.success) {
  expect(result.body).toEqual({ value: 'hello' }) // Still need type guard
}

// DON'T do this either - even less informative on failure
expect(result).toMatchObject({ success: true }) // ❌ No narrowing, weak diagnostic
```

### Error assertions with `rejects.toSatisfy`

Decision rule:

- Use `rejects.toThrow()` (no argument) when the only assertion is that an error was thrown.
- Use `rejects.toThrow(message)` (string or regex) **only** when the only assertion beyond "an error was thrown" is the message string itself. No other property of the error is checked.
- Use `rejects.toSatisfy()` in every other case, including when asserting any property besides the message (e.g. `err.cause`, `err instanceof X`, `err.code`) — even if exactly one such property is being checked.

If any `expect()` or `assert()` inside the `toSatisfy` callback throws, the test will fail with that assertion error. The `return true` is only reached when all inner assertions pass. Do not wrap inner assertions in try/catch.

```ts
await expect(someAsyncFn()).rejects.toSatisfy((err) => {
  assert(err instanceof SomeError)
  expect(err.cause).toBeInstanceOf(TypeError)
  expect(err.message).toContain('failed')
  return true // must return true
})
```

Always `return true` at the end of `toSatisfy` callbacks.

Examples of valid `toThrow()` usage (message-only or no argument):

```ts
expect(() => parseCid(invalidStr)).toThrow()
expect(() => cidForRawHash(new Uint8Array(31))).toThrow(
  'Invalid SHA-256 hash length',
)
```

## Mock functions

### Use `vi.fn()` with type parameters

When you need to inspect how a function was called, use `vi.fn<Type>()`:

```ts
const fetchHandler = vi.fn<FetchHandler>(async () =>
  Response.json({ value: 'ok' }),
)

await xrpc(fetchHandler, testQuery, { params: { limit: 25 } })

expect(fetchHandler).toHaveBeenCalledOnce()
const [path, init] = fetchHandler.mock.calls[0]
expect(path).toContain('/xrpc/io.example.testQuery')
```

When you don't need to inspect calls, use a plain typed function:

```ts
const fetchHandler: FetchHandler = async () => Response.json({ value: 'hello' })
```

### Use `using` for auto-restored spies

`vi.spyOn` and `vi.fn` results are `Disposable` — declaring them with `using` automatically calls `mockRestore()` at the end of the enclosing block, so you don't need an `afterEach` or a `try`/`finally` to clean up. Prefer `using` whenever the spy is scoped to a single test (or a single block within a test):

```ts
it('sends an update email when the address changes', async () => {
  using sendUpdateEmailMock = vi
    .spyOn(network.pds.ctx.mailer, 'sendUpdateEmail')
    .mockImplementation(async () => {
      // noop
    })

  await client.call(com.atproto.server.requestEmailUpdate)

  expect(sendUpdateEmailMock).toHaveBeenCalledOnce()
}) // spy is automatically restored here
```

This applies broadly to anything resource-like that exposes `[Symbol.dispose]` / `[Symbol.asyncDispose]` — reach for `using` (or `await using`) before falling back to manual cleanup.

### Mocking node built-ins

`vi.mock` of a node built-in usually needs both default and named exports, since callers may use either form:

```ts
vi.mock('node:dns/promises', () => {
  const mock = { resolveTxt: vi.fn() }
  return { default: mock, ...mock }
})
```

### Partial module mocks with `vi.importActual`

Spread the actual module to mock only specific exports:

```ts
vi.mock('../../src/api/age-assurance/const.js', async () => {
  const actual = await vi.importActual<typeof import('...')>('...')
  return { ...actual, FOO: 'overridden' }
})
```

## Test fixtures

Define reusable fixtures at the top of the file, outside describe blocks:

```ts
const invalidCidStr = 'invalidcidstring'
const cborCidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
const cborCid = parseCid(cborCidStr, { flavor: 'cbor' })
```

Keep fixtures minimal and focused on what the tests need.

### JSON fixture files

When fixtures are large or shared across SDKs (`interop-test-files/`, generated vector files), import them with the JSON import attribute and feed them to `test.each`. Each fixture is a case identifier, so use `test.each` (not `it.each`) and use `$name` (or another property) as the label template:

```ts
import fixtures from './fixtures.json' with { type: 'json' }

describe('decode', () => {
  test.each(fixtures)('$name', ({ input, expected }) => {
    expect(decode(input)).toEqual(expected)
  })
})
```

For text-based interop fixtures, read the file at module load, parse it once, and pass the resulting array straight to `test.each`:

```ts
const fixtureCases = fs
  .readFileSync(
    path.join(__dirname, '../../../interop-test-files/syntax/aturi_valid.txt'),
    'utf8',
  )
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))

test.each(fixtureCases)('%s', (line) => { ... })
```

When the same suite must run against several implementations of the same interface, parameterize the suite with `describe.each` (the implementation is the case identifier) and keep the inner labels as `it('<description>', ...)`:

```ts
describe.each([utf8LenNode, utf8LenCompute] as const)('%o', (utf8Len) => {
  assert(utf8Len)

  it('computes utf8 string length', () => {
    expect(utf8Len('a')).toBe(1)
  })
})
```

Reach for raw `for (const x of cases) { test(x.name, ...) }` only when the body shape genuinely can't be expressed via `test.each` — for example, when each case needs a different `describe` nesting or a different number of assertions.

## TypeScript in tests

### Intentionally invalid arguments

Use `// @ts-expect-error` with a description:

```ts
await xrpc(fetchHandler, testQuery, {
  // @ts-expect-error intentionally passing invalid params
  params: { limit: 'not-a-number' },
  validateRequest: true,
})
```

### Type-level assertions with `expectTypeOf`

For assertions about _types_ (not runtime values), use vitest's `expectTypeOf`:

```ts
import { expectTypeOf } from 'vitest'

expectTypeOf(result).toEqualTypeOf<{ value: string }>()
expectTypeOf(handler).parameter(0).toMatchTypeOf<Request>()
expectTypeOf(client.foo).not.toBeAny()
```

`expectTypeOf` is preferred over a hand-rolled `const expectType = <T>(_: T) => {}` helper. It compiles to nothing at runtime, so it's free.

## Roundtrip tests

When testing encode/decode or serialize/deserialize pairs, add a dedicated roundtrip describe:

```ts
describe('roundtrip toBase64 <-> fromBase64', () => {
  it('roundtrips empty array', () => {
    const original = new Uint8Array(0)
    expect(ui8Equals(fromBase64(toBase64(original)), original)).toBe(true)
  })

  it('roundtrips all byte values', () => {
    const allBytes = new Uint8Array(256)
    for (let i = 0; i < 256; i++) allBytes[i] = i
    expect(ui8Equals(fromBase64(toBase64(allBytes)), allBytes)).toBe(true)
  })
})
```

## Running tests

```bash
pnpm run test -- path/to/file.test.ts
```
