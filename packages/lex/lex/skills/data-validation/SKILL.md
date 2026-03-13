---
name: data-validation
description: >
  Using generated schema utilities: $build, $validate, $parse, $safeParse,
  $check, $isTypeOf, $cast, $assert. The l namespace for imperative schema
  building (l.string, l.integer, l.object, l.typedObject, l.record, l.query,
  l.procedure). String format validators: datetime, handle, did, nsid, at-uri,
  cid, tid, language. LexValidationError handling. Typed union discrimination.
type: core
library: '@atproto/lex'
library_version: '0.0.20'
sources:
  - 'bluesky-social/atproto:packages/lex/lex/README.md'
  - 'bluesky-social/atproto:packages/lex/lex-schema/src/schema.ts'
  - 'bluesky-social/atproto:packages/lex/lex-schema/src/external.ts'
---

# Data Validation

Runtime type safety for AT Protocol data using generated schema utilities and
the `l` namespace from `@atproto/lex`.

## Setup

Minimum working example using `$build` and `$validate`:

```typescript
import { app } from '@atproto/lex'

// $build auto-injects $type and applies defaults
const post = app.bsky.feed.post.$build({
  text: 'Hello from @atproto/lex!',
  createdAt: new Date().toISOString(),
})

// $validate checks that fully-formed data conforms to the schema
const result = app.bsky.feed.post.$validate(post)
if (!result.success) {
  console.error(result.errors)
}
```

`$build` returns a fully typed object with `$type` injected. `$validate`
returns a discriminated result: `{ success: true, value }` or
`{ success: false, errors }`.

## Core Patterns

### 1. Building data with `$build`

`$build` is the safest way to construct records. It injects `$type`, applies
default values, and returns the correct TypeScript type.

```typescript
import { app } from '@atproto/lex'

const like = app.bsky.feed.like.$build({
  subject: {
    uri: 'at://did:plc:example/app.bsky.feed.post/abc123',
    cid: 'bafyreig...',
  },
  createdAt: new Date().toISOString(),
})
// like.$type === 'app.bsky.feed.like' (injected automatically)

const profile = app.bsky.actor.profile.$build({
  displayName: 'Alice',
  // description, avatar, banner get defaults or remain undefined
})
```

### 2. Parsing untrusted input with `$safeParse`

Use `$safeParse` for data from network requests, user input, or storage.
It applies coercion and defaults before validating.

```typescript
import { app } from '@atproto/lex'

function handleIncomingRecord(data: unknown) {
  const result = app.bsky.feed.post.$safeParse(data)
  if (!result.success) {
    // result.errors contains LexValidationError[]
    for (const err of result.errors) {
      console.error(`${err.path}: ${err.message}`)
    }
    return
  }
  // result.value is fully typed as app.bsky.feed.post record
  const post = result.value
  console.log(post.text, post.createdAt)
}
```

When you are confident the data is valid and want to throw on failure, use
`$parse` instead:

```typescript
// Throws LexValidationError if invalid
const post = app.bsky.feed.post.$parse(data)
```

### 3. Type discrimination with `$isTypeOf`

Use `$isTypeOf` to narrow union types in branches and loops. It performs an
O(1) check on the `$type` field only -- no full validation.

```typescript
import { app } from '@atproto/lex'

type FeedItem =
  | app.bsky.feed.post.Record
  | app.bsky.feed.repost.Record
  | app.bsky.feed.like.Record

function processFeedItems(items: FeedItem[]) {
  for (const item of items) {
    if (app.bsky.feed.post.$isTypeOf(item)) {
      // item is narrowed to app.bsky.feed.post.Record
      console.log('Post:', item.text)
    } else if (app.bsky.feed.repost.$isTypeOf(item)) {
      console.log('Repost:', item.subject.uri)
    }
  }
}
```

When you need full validation inside a discriminated branch, call `$check`:

```typescript
if (app.bsky.feed.post.$isTypeOf(item)) {
  const valid = app.bsky.feed.post.$check(item)
  if (!valid.success) { /* handle */ }
}
```

### 4. Extracting TypeScript types

Generated schemas export TypeScript types that mirror the Lexicon definitions.

```typescript
import type { app } from '@atproto/lex'

// Record types
type Post = app.bsky.feed.post.Record
type Like = app.bsky.feed.like.Record

// Input/output types for queries and procedures
type GetPostsParams = app.bsky.feed.getPosts.Params
type GetPostsOutput = app.bsky.feed.getPosts.Output

function createPost(text: string, createdAt: string): Post {
  return app.bsky.feed.post.$build({ text, createdAt })
}
```

## Common Mistakes

### CRITICAL: Confusing `$validate` with `$parse`

`$validate` rejects data that needs coercion or is missing default values.
`$parse` applies defaults and coercion before validating.

```typescript
// WRONG: $validate on raw user input with missing optional fields
const result = app.bsky.feed.post.$validate(userInput)
// Fails if optional fields are absent that have defaults

// CORRECT: $parse applies defaults and coercion first
const result = app.bsky.feed.post.$parse(userInput)
```

Use `$validate` only on data you have already constructed (e.g., output of
`$build`). Use `$parse` or `$safeParse` on untrusted or external data.

### HIGH: Using `$check` when `$isTypeOf` is needed

`$check` performs full schema validation, which is expensive. `$isTypeOf`
only checks the `$type` field in O(1) time.

```typescript
// WRONG: full validation just to discriminate type in a hot loop
for (const record of records) {
  if (app.bsky.feed.post.$check(record).success) {
    handlePost(record)
  }
}

// CORRECT: O(1) type check for discrimination
for (const record of records) {
  if (app.bsky.feed.post.$isTypeOf(record)) {
    handlePost(record)
  }
}
```

### HIGH: Omitting `$type` in `$validate` but not `$build`

`$build` auto-injects `$type`. `$validate` requires `$type` to already be
present in the data.

```typescript
// WRONG: missing $type -- $validate will reject this
app.bsky.feed.post.$validate({
  text: 'Hello!',
  createdAt: new Date().toISOString(),
})

// CORRECT: include $type explicitly when using $validate
app.bsky.feed.post.$validate({
  $type: 'app.bsky.feed.post',
  text: 'Hello!',
  createdAt: new Date().toISOString(),
})

// OR: use $build which injects $type for you
const post = app.bsky.feed.post.$build({
  text: 'Hello!',
  createdAt: new Date().toISOString(),
})
app.bsky.feed.post.$validate(post) // $type is present
```

### MEDIUM: Using open union when closed is needed

Open unions accept records with unknown `$type` values. Closed unions reject
them. Choose the right one based on whether you need forward compatibility.

```typescript
import { l } from '@atproto/lex'

// Open union: accepts unknown $type values (forward-compatible)
const feedItemOpen = l.union([
  app.bsky.feed.post,
  app.bsky.feed.repost,
]) // unknown $type passes through

// Closed union: rejects unknown $type values (strict)
const feedItemClosed = l.closedUnion([
  app.bsky.feed.post,
  app.bsky.feed.repost,
]) // unknown $type is a validation error
```

Use closed unions when processing data in a context where unknown types
indicate a bug. Use open unions at API boundaries where new types may be
added.

### MEDIUM: Expecting floats to pass integer validation

Integer schemas use `Number.isSafeInteger()`, which rejects all
floating-point values.

```typescript
import { l } from '@atproto/lex'

const schema = l.integer({ minimum: 0, maximum: 100 })

// WRONG: float will fail validation
schema.$validate(3.14) // fails -- not a safe integer

// CORRECT: pass an integer
schema.$validate(3)    // succeeds
```

### CRITICAL (cross-skill, from data-model): Using string length instead of `graphemeLen`

AT Protocol string length constraints use grapheme clusters, not JavaScript
string length. A single emoji may be one grapheme but multiple UTF-16 code
units.

```typescript
// WRONG: JavaScript .length counts UTF-16 code units
if (post.text.length > 300) {
  throw new Error('Post too long')
}

// CORRECT: count grapheme clusters
import { graphemeLen } from '@atproto/lex'

if (graphemeLen(post.text) > 300) {
  throw new Error('Post too long')
}
```

See the [data-model skill](../data-model/SKILL.md) for full details on string
encoding requirements.

## Tension: Validation Strictness vs. Ease of Use

There is an inherent tension between **data-validation** and **client-api**:

- **Strict validation** (`$validate`, closed unions) catches bugs early and
  ensures data integrity, but requires callers to provide fully-formed data
  including `$type` fields, correct string formats, and explicit values for
  every required property.

- **Ease of use** (`$build`, `$parse`, open unions) reduces friction by
  injecting defaults, coercing values, and tolerating unknown types, but may
  mask data issues that surface later in the pipeline.

**Guideline:** Use strict validation (`$validate`, closed unions) on data you
produce. Use lenient parsing (`$parse`, `$safeParse`, open unions) on data you
consume. This balances correctness with interoperability.

## References

- [l namespace reference](references/l-namespace.md) -- imperative schema
  building with `l.string`, `l.integer`, `l.object`, `l.typedObject`,
  `l.record`, `l.query`, `l.procedure`, and union constructors.
- [String format validators reference](references/string-formats.md) --
  `datetime`, `handle`, `did`, `nsid`, `at-uri`, `cid`, `tid`, `language`
  format validation details and edge cases.

## See Also

- [data-model](../data-model/SKILL.md) -- AT Protocol data structures,
  grapheme length, blob references, and CID handling.
- [server-setup](../server-setup/SKILL.md) -- configuring XRPC servers with
  schema validation middleware.
- [client-api](../client-api/SKILL.md) -- high-level client that uses these
  validation utilities internally.
