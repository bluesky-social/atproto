---
name: client-api
description: >
  Client class for authenticated XRPC. OAuth and PasswordSession auth.
  Record CRUD: client.create(), get(), put(), delete(), list(). client.call()
  for queries, procedures, and Actions. client.xrpc(), client.xrpcSafe().
  assertAuthenticated(), did, assertDid. Labeler configuration: setLabelers,
  addLabelers, clearLabelers, Client.configure(). Service proxy. Child Clients.
  swapCommit, swapRecord optimistic concurrency.
type: core
library: '@atproto/lex'
library_version: '0.0.20'
requires:
  - atproto-lex/xrpc-requests
  - atproto-lex/data-validation
sources:
  - 'bluesky-social/atproto:packages/lex/lex/README.md'
  - 'bluesky-social/atproto:packages/lex/lex-client/src/client.ts'
  - 'bluesky-social/atproto:packages/lex/lex-password-session/src/password-session.ts'
---

# Client API

The `Client` class is the primary interface for authenticated AT Protocol
operations. It wraps an authentication session (OAuth or PasswordSession) and
provides type-safe record CRUD, XRPC calls, Actions, labeler configuration,
and service proxying.

## 1. Setup

### Authenticated Client with OAuth

```typescript
import { Client } from '@atproto/lex'
import { OAuthClient } from '@atproto/oauth-client-node'

// Configure your OAuth client (see @atproto/oauth-client docs)
const oauthClient = new OAuthClient({
  clientMetadata: { /* ... */ },
  stateStore,
  sessionStore,
})

// Restore an existing session for a user
const session = await oauthClient.restore(userDid)

// Create an authenticated client
const client = new Client(session)

// The client exposes the authenticated user's DID
console.log(client.did) // 'did:plc:...'
```

### Authenticated Client with PasswordSession

For CLI tools, scripts, and bots:

```typescript
import { Client } from '@atproto/lex'
import { PasswordSession } from '@atproto/lex-password-session'

const session = await PasswordSession.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'xxxx-xxxx-xxxx-xxxx', // App password
  onUpdated: (data) => saveToStorage(data),
  onDeleted: (data) => clearStorage(data.did),
})

const client = new Client(session)
```

## 2. Core Patterns

### Creating Records

```typescript
import { l } from '@atproto/lex'
import * as app from './lexicons/app.js'

const result = await client.create(app.bsky.feed.post, {
  text: 'Hello from the AT Protocol!',
  createdAt: l.toDatetimeString(new Date()),
})

console.log(result.uri) // 'at://did:plc:.../app.bsky.feed.post/3jxf7z2k3q2'
console.log(result.cid) // 'bafyrei...'
```

### Listing Records with Pagination

```typescript
import * as app from './lexicons/app.js'

async function getAllPosts(client: Client) {
  const posts: app.bsky.feed.post.Main[] = []
  let cursor: string | undefined

  do {
    const page = await client.list(app.bsky.feed.post, {
      limit: 100,
      cursor,
    })

    for (const record of page.records) {
      posts.push(record.value)
    }

    cursor = page.cursor
  } while (cursor)

  return posts
}
```

### Updating Profile with Optimistic Concurrency (swapRecord)

Use `swapRecord` to prevent lost updates when multiple clients may write
to the same record concurrently. If the record changed since you read it,
the server rejects the write and you retry with a fresh read.

```typescript
import * as app from './lexicons/app.js'

async function updateProfile(
  client: Client,
  update: Partial<app.bsky.actor.profile.Main>,
) {
  const MAX_RETRIES = 3

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Read current profile and its CID
    const current = await client.get(app.bsky.actor.profile)

    // Merge updates
    const updated = { ...current, ...update }

    try {
      return await client.put(app.bsky.actor.profile, updated, {
        swapRecord: current.cid,
      })
    } catch (err) {
      // If a concurrent write happened, the CID won't match.
      // Retry by re-reading the record.
      if (
        err instanceof Error &&
        err.message.includes('InvalidSwap') &&
        attempt < MAX_RETRIES - 1
      ) {
        continue
      }
      throw err
    }
  }
}

await updateProfile(client, {
  displayName: 'Alice',
  description: 'Updated concurrently-safe',
})
```

### Configuring Labelers

Labelers tell the server which content moderation services should apply
labels to the returned data.

```typescript
import { Client } from '@atproto/lex'

// Global app-level labelers (applied to ALL Client instances)
Client.configure({
  appLabelers: ['did:plc:ar7c4by46qjdydhdevvrndac'], // Bluesky moderation
})

// Per-client labelers (merged with app labelers on each request)
const client = new Client(session, {
  labelers: ['did:plc:custom-labeler'],
})

// Dynamic labeler management
client.addLabelers(['did:plc:another-labeler'])
client.setLabelers(['did:plc:replace-all'])
client.clearLabelers()

// Child client inherits parent labelers and adds its own
const childClient = new Client(client, {
  labelers: ['did:plc:child-specific-labeler'],
  service: 'did:web:api.bsky.app#bsky_appview',
})
```

## 3. Common Mistakes

### CRITICAL: Using `new Date().toISOString()` for createdAt

`new Date().toISOString()` is not guaranteed to produce a valid AT Protocol
datetime for edge cases (years before 10 or after 9999). The type system
expects `DatetimeString`, not `string`.

```typescript
// WRONG - not type-safe, fails on edge-case dates
await client.create(app.bsky.feed.post, {
  text: 'Hello!',
  createdAt: new Date().toISOString(),
})

// CORRECT - validated DatetimeString
import { l } from '@atproto/lex'

await client.create(app.bsky.feed.post, {
  text: 'Hello!',
  createdAt: l.toDatetimeString(new Date()),
})

// ALSO CORRECT - current time shorthand
await client.create(app.bsky.feed.post, {
  text: 'Hello!',
  createdAt: l.currentDatetimeString(),
})
```

> Cross-ref: Also covered in `data-model` skill.

### HIGH: Missing rkey for Non-Literal Record Keys

Records with literal keys (e.g., `app.bsky.actor.profile` uses `"self"`)
don't need `rkey`. Records with dynamic keys (posts, likes) require `rkey`
when calling `get()`, `put()`, or `delete()`. Omitting it throws a
`TypeError`.

```typescript
import * as app from './lexicons/app.js'

// Profile has literal key "self" - rkey is optional
const profile = await client.get(app.bsky.actor.profile)

// Post has a TID key - rkey is REQUIRED for get/put/delete
// WRONG - TypeScript error, runtime TypeError
await client.get(app.bsky.feed.post)

// CORRECT
const post = await client.get(app.bsky.feed.post, {
  rkey: '3jxf7z2k3q2',
})
```

> Note: `create()` auto-generates TID keys, so `rkey` is optional there.

### HIGH: Not Using swapRecord for Concurrent Updates

Without `swapRecord`, concurrent writes to the same record cause last-write-wins
with no conflict detection. This silently loses data.

```typescript
import * as app from './lexicons/app.js'

// WRONG - no concurrency protection
await client.put(app.bsky.actor.profile, {
  displayName: 'Alice',
  description: 'New bio',
})

// CORRECT - optimistic concurrency with swapRecord
const current = await client.get(app.bsky.actor.profile)
await client.put(
  app.bsky.actor.profile,
  { ...current, displayName: 'Alice' },
  { swapRecord: current.cid },
)
```

See the full retry pattern in [Updating Profile with Optimistic Concurrency](#updating-profile-with-optimistic-concurrency-swaprecord) above.

### HIGH: Calling Client Methods Without Authentication

`create()`, `put()`, `delete()`, and `list()` require an authenticated
session. Calling them on an unauthenticated client throws
`"Client is not authenticated"`.

```typescript
import { Client } from '@atproto/lex'
import * as app from './lexicons/app.js'

// Unauthenticated client - only has a service URL
const publicClient = new Client('https://public.api.bsky.app')

// WRONG - throws "Client is not authenticated"
await publicClient.create(app.bsky.feed.post, { /* ... */ })

// CORRECT - guard with assertAuthenticated or use assertDid
client.assertAuthenticated()
// TypeScript now knows client.did is defined
await client.create(app.bsky.feed.post, {
  text: 'Hello!',
  createdAt: l.toDatetimeString(new Date()),
})

// Or use assertDid as a shorthand
const did = client.assertDid // throws if not authenticated
```

### MEDIUM: ReadableStream Body Prevents Retry on 401

`PasswordSession` automatically refreshes tokens and retries on 401
responses. However, if the request body is a `ReadableStream`, it cannot
be replayed after consumption. The retry silently fails.

```typescript
// WRONG - ReadableStream body can't be retried after token refresh
await client.xrpc(com.atproto.repo.uploadBlob, {
  body: someReadableStream,
})

// CORRECT - use ArrayBuffer, Uint8Array, or Blob for retryable bodies
const bytes = new Uint8Array(await someReadableStream.arrayBuffer())
await client.xrpc(com.atproto.repo.uploadBlob, {
  body: bytes,
})
```

### MEDIUM: Not Configuring Labelers for Content Moderation

Without labelers configured, the server won't include content labels in
responses. Moderation-dependent UI (hide, warn, blur) won't work.

```typescript
import { Client } from '@atproto/lex'

// WRONG - no labelers, content labels missing from responses
const client = new Client(session)
const timeline = await client.call(app.bsky.feed.getTimeline, { limit: 50 })
// timeline items have no content labels applied

// CORRECT - configure labelers before making requests
Client.configure({
  appLabelers: ['did:plc:ar7c4by46qjdydhdevvrndac'],
})

const client = new Client(session, {
  labelers: ['did:plc:my-custom-labeler'],
})
const timeline = await client.call(app.bsky.feed.getTimeline, { limit: 50 })
// timeline items now include content labels from configured labelers
```

## 4. Tensions

**Simple `xrpc()` vs. Client abstraction.** The standalone `xrpc()` function
is stateless and requires no setup -- pass a URL, a schema, and options. The
`Client` class adds authentication, labelers, service proxying, and record
CRUD helpers. Use `xrpc()` for simple unauthenticated reads. Use `Client`
when you need session management, record operations, or composable
configuration via child clients.

**Validation strictness vs. ease of use.** `client.create()` accepts a
`validate` option that checks record data against the Lexicon schema before
sending. Enabling validation catches malformed data early but adds overhead
and may reject records that the server would accept (e.g., with newer schema
versions). By default, validation is not enforced on the client side -- the
server performs its own validation on write.

## 5. See Also

- **xrpc-requests** -- Standalone `xrpc()` and `xrpcSafe()` for
  unauthenticated or low-level XRPC calls.
- **data-validation** -- Schema validation with `$validate()`, `$build()`,
  `$isTypeOf()`, and `DatetimeString` utilities.
- **actions-composition** -- Defining and composing `Action` functions
  invoked via `client.call()`.
- **data-model** -- AT Protocol data model types (`LexValue`, `Cid`,
  `BlobRef`), JSON/CBOR encoding.
