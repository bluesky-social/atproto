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

4. Create `tsconfig.tests.json` extending the shared vitest config:

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

## Imports

Always import test utilities from `vitest` using named imports:

```ts
import { assert, describe, expect, it, vi } from 'vitest'
```

## Test structure

### Describe labels

Pass the function/class reference as the describe label when the export is a named function or class. Use a string label when testing an arrow function assigned to a variable, a class method, or multiple related behaviors that don't map to a single export:

```ts
// Function reference as label (preferred when testing a single export)
describe(parseCid, () => { ... })
describe(isLexValue, () => { ... })

// String label for conceptual groups or when testing multiple related behaviors
describe('roundtrip toBase64 <-> fromBase64', () => { ... })
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

Use `it.each` over test case arrays:

```ts
describe(isLexScalar, () => {
  it.each([
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

This also works for running the same test suite against multiple implementations:

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

## Test fixtures

Define reusable fixtures at the top of the file, outside describe blocks:

```ts
const invalidCidStr = 'invalidcidstring'
const cborCidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
const cborCid = parseCid(cborCidStr, { flavor: 'cbor' })
```

Keep fixtures minimal and focused on what the tests need.

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
pnpm exec vitest run path/to/file.test.ts
```
