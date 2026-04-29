---
name: vitest-patterns
description: Patterns and conventions for writing vitest tests in this project. This skill should be used when writing new tests, adding test cases to existing test files, or reviewing test code for correctness. Trigger whenever the user asks to write tests, add test coverage, create test files, or mentions vitest/testing.
---

# Vitest Test Patterns

Conventions and patterns for writing vitest tests in this codebase.

## Imports

Always import test utilities from `vitest`. Use named imports:

```ts
import { assert, describe, expect, it, test, vi } from 'vitest'
```

Only import what you use. Add `vi` only when using mock functions. Add `assert` only when narrowing types.

## Test Structure

### Describe labels

Pass the function/class under test directly as the `describe` label when possible. Use string labels for conceptual groupings:

```ts
// Function reference as label (preferred when testing a single export)
describe(parseCid, () => { ... })
describe(isLexValue, () => { ... })

// Class reference as label
describe(Stack, () => { ... })

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
describe(validateResponse, () => {
  it('rejects invalid response body by default', ...)
  it('accepts invalid response body when disabled', ...)
  it('succeeds with valid response body when enabled', ...)
})
```

## Parameterized Tests

Use `test.each` loops over test case arrays. This is preferred when individual tests run multiple checks on the same input values. When only individual checks are performed, prefer inlining all the checks.

```ts
// AVOID - using test.each for single assertions makes it harder to read and debug
describe(isLexScalar, () => {
  test.each([
    { value: 'foo', expected: true },
    { value: 42, expected: true },
    { value: 3.14, expected: false },
    { value: undefined, expected: false },
  ])('$value', ({ value, expected }) => {
    expect(isLexScalar(value)).toBe(expected)
  })
})

// PREFERRED - inline assertions for simple cases
describe(isLexScalar, () => {
  it('returns true for valid values', () => {
    expect(isLexScalar('foo')).toBe(true)
    expect(isLexScalar(42)).toBe(true)
  })
  it('returns false for invalid values', () => {
    expect(isLexScalar(3.14)).toBe(false)
    expect(isLexScalar(undefined)).toBe(false)
  })
})
```

For more complex cases, `test.each` is great for reducing boilerplate and improving maintainability:

```ts
// PREFERRED - using test.each for multiple assertions on the same input values
test.each([
  { text: 'hello', length: 5 },
  { text: '👋', length: 4 },
  { text: '𐍈', length: 4 },
])('$text', ({ text, length }) => {
  expect(utf8Len(text)).toBe(length)
  expect(utf8Len(text)).toBe(Buffer.byteLength(text, 'utf8'))
})
```

This also works for running the same test suite against multiple implementations:

```ts
// Display the function/class name in test titles using "%o"
describe.each([utf8LenNode, utf8LenCompute])('%o', (utf8Len) => {
  // Type narrowing for better editor support (if needed)
  assert(utf8Len)

  // Do not use test.each for single assertions
  expect(utf8Len('hello')).toBe(5)
  expect(utf8Len('👋')).toBe(4)
  expect(utf8Len('𐍈')).toBe(4)
})
```

When test cases are too long, use a `name` property for better titles:

```ts
test.each([
  { name: 'empty array', input: [] },
  { name: 'array of numbers', input: [1, 2, 3] },
  { name: 'array of strings', input: ['a', 'b'] },
])('valid: $name', ({ input }) => {
  describe(isLexValue, () => {
    it('returns true', () => {
      expect(isLexValue(input)).toBe(true)
    })
  })

  describe(jsonToLex, () => {
    it('roundtrips through JSON', () => {
      expect(lexToJson(jsonToLex(input))).toStrictEqual(input)
    })
  })
})
```

When editing and existing test suite, replace existing loops with `test.each`/`describe.each`.

## Assertions

### Type narrowing with `assert`

Use `assert()` from vitest for type narrowing and boolean checks. **Always prefer `assert(result.success)` over `expect(result.success).toBe(true)`** — the `assert` provides type narrowing in TypeScript, which allows the rest of the test to access narrowed properties without additional type guards.

```ts
// Narrow to a specific type before further assertions
assert(err instanceof XrpcFetchError)
expect(err.message).toBe('Fetch failed')

// Discriminated union checks - PREFERRED
assert(result.success)
expect(result.body).toEqual({ value: 'hello' })

assert(!result.success)
expect(result.message).toContain('invalid response body')

// DON'T do this - it doesn't narrow types
expect(result.success).toBe(true) // ❌ No type narrowing
if (result.success) {
  expect(result.body).toEqual({ value: 'hello' }) // Still need type guard
}
```

### Error assertions with `rejects.toSatisfy`

For thrown errors, prefer `rejects.toSatisfy()` over `rejects.toThrow()` when you need multiple detailed assertions:

```ts
await expect(someAsyncFn()).rejects.toSatisfy((err) => {
  assert(err instanceof SomeError)
  expect(err.message).toBe('Fetch failed')
  return true // must return true
})
```

Always `return true` at the end of `toSatisfy` callbacks.

For simple "it throws" checks, `toThrow()` is fine:

```ts
expect(() => parseCid(invalidStr)).toThrow()
expect(() => cidForRawHash(new Uint8Array(31))).toThrow(
  'Invalid SHA-256 hash length',
)
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
    expect(() => buildAgent({ service: 'https://example.com' })).toThrow(
      'fetch is not available in this environment',
    )
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
# From project folder
pnpm test
pnpm test path/to/file.test.ts

# From repo root
pnpm exec vitest run
pnpm exec vitest run path/to/file.test.ts
```
