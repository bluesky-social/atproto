---
name: vitest-patterns
description: Patterns and conventions for writing vitest tests in this project. This skill should be used when writing new tests, adding test cases to existing test files, or reviewing test code for correctness. Trigger whenever the user asks to write tests, add test coverage, create test files, or mentions vitest/testing.
---

# Vitest Test Patterns

Conventions and patterns for writing vitest tests in this codebase.

## Imports

Always import test utilities from `vitest`. Use named imports:

```ts
import { assert, describe, expect, it, vi } from 'vitest'
```

Only import what you use. Add `vi` only when using mock functions. Add `assert` only when narrowing types.

## Test Structure

### Describe labels

Pass the function/class under test directly as the `describe` label when possible. Use string labels for conceptual groupings:

```ts
// Function reference as label (preferred when testing a single export)
describe(parseCid, () => { ... })
describe(isLexValue, () => { ... })

// String label for conceptual groups or when testing multiple related behaviors
describe('roundtrip toBase64 <-> fromBase64', () => { ... })
describe('isObject', () => { ... })
```

### Grouping

Nest logical groupings inside the top-level describe. Common groupings:

```ts
describe(someFunction, () => {
  describe('valid inputs', () => { ... })
  describe('invalid inputs', () => { ... })
  describe('edge cases', () => { ... })
})
```

For features with a default behavior and an override, cover both:

```ts
describe('validateResponse', () => {
  it('rejects invalid response body by default', ...)
  it('accepts invalid response body when disabled', ...)
  it('succeeds with valid response body when enabled', ...)
})
```

For safety-critical code, group edge cases under a `'safety'` or `'edge cases'` describe:

```ts
describe('safety', () => {
  it('handles cyclic structures without infinite loops', () => { ... })
  it('handles deep structures without exceeding call stack', () => { ... })
})
```

## Parameterized Tests

Use `for...of` loops over test case arrays instead of `it.each`:

```ts
describe(isLexScalar, () => {
  for (const { note, value, expected } of [
    { note: 'string', value: 'hello', expected: true },
    { note: 'boolean', value: true, expected: true },
    { note: 'null', value: null, expected: true },
    { note: 'number (float)', value: 3.14, expected: false },
    { note: 'undefined', value: undefined, expected: false },
  ]) {
    it(note, () => {
      expect(isLexScalar(value)).toBe(expected)
    })
  }
})
```

This also works for running the same test suite against multiple implementations:

```ts
for (const utf8Len of [utf8LenNode!, utf8LenCompute!] as const) {
  describe(utf8Len, () => {
    it('computes utf8 string length', () => {
      expect(utf8Len('a')).toBe(1)
    })
  })
}
```

## Assertions

### Type narrowing with `assert`

Use `assert()` from vitest for type narrowing and boolean checks:

```ts
// Narrow to a specific type before further assertions
assert(err instanceof XrpcFetchError)
expect(err.cause).toBeInstanceOf(TypeError)

// Discriminated union checks
assert(result.success)
expect(result.body).toEqual({ value: 'hello' })

assert(!result.success)
expect(result).toBeInstanceOf(XrpcResponseError)
```

### Error assertions with `rejects.toSatisfy`

For thrown errors, prefer `rejects.toSatisfy()` over `rejects.toThrow()` when you need multiple detailed assertions:

```ts
await expect(
  someAsyncFn(),
).rejects.toSatisfy((err) => {
  assert(err instanceof SomeError)
  expect(err.cause).toBeInstanceOf(TypeError)
  expect(err.message).toContain('failed')
  return true // must return true
})
```

Always `return true` at the end of `toSatisfy` callbacks.

For simple "it throws" checks, `toThrow()` is fine:

```ts
expect(() => parseCid(invalidStr)).toThrow()
expect(() => cidForRawHash(new Uint8Array(31))).toThrow('Invalid SHA-256 hash length')
```

## Mock Functions

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

## Test Fixtures

Define reusable fixtures at the top of the file, outside describe blocks:

```ts
const invalidCidStr = 'invalidcidstring'
const cborCidStr = 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'
const cborCid = parseCid(cborCidStr, { flavor: 'cbor' })
```

Keep fixtures minimal and focused on what the tests need.

## TypeScript in Tests

### Intentionally invalid arguments

Use `// @ts-expect-error` with a description:

```ts
await xrpc(fetchHandler, testQuery, {
  // @ts-expect-error intentionally passing invalid params
  params: { limit: 'not-a-number' },
  validateRequest: true,
})
```

## Global Stubbing

When testing code that uses a global, temporarily replace it and restore in a `finally` block:

```ts
it('throws TypeError when fetch is not available', () => {
  const originalFetch = globalThis.fetch
  try {
    // @ts-expect-error removing fetch to simulate missing environment
    globalThis.fetch = undefined
    expect(() => buildAgent({ service: 'https://example.com' })).toThrow(TypeError)
  } finally {
    globalThis.fetch = originalFetch
  }
})
```

Use `try/finally` (not `beforeEach`/`afterEach`) when the stub is scoped to a single test.

## Roundtrip Tests

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

## Workflow

- Do not worry about code formatting or lint issues. The user will review changes in their editor, which applies formatting automatically on save.
- Do not commit test changes. Leave them as unstaged modifications for the user to review.

## Running Tests

```bash
pnpm exec vitest run path/to/file.test.ts
```
