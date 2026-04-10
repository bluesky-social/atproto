---
name: xrpc-requests
description: >
  Making typed XRPC HTTP requests with xrpc() (throws) and xrpcSafe()
  (returns Result). XrpcResponse, XrpcFailure union: XrpcResponseError,
  XrpcUpstreamError, XrpcInternalError, XrpcFetchError. shouldRetry(),
  matchesSchemaErrors(). CallOptions: signal, headers, validateRequest,
  validateResponse. Retryable HTTP status codes 408 425 429 500 502 503 504.
type: core
library: '@atproto/lex'
library_version: '0.0.20'
sources:
  - 'bluesky-social/atproto:packages/lex/lex/README.md'
  - 'bluesky-social/atproto:packages/lex/lex-client/src/xrpc.ts'
  - 'bluesky-social/atproto:packages/lex/lex-client/src/errors.ts'
---

# XRPC Requests

Make typed HTTP requests to AT Protocol services using `xrpc()` and `xrpcSafe()` from `@atproto/lex`. Both functions take an agent (URL string or `Agent` instance), a generated lexicon schema, and an options object. The difference: `xrpc()` throws on failure, `xrpcSafe()` returns a discriminated union.

## Setup

Install lexicons and generate TypeScript schemas:

```bash
lex install app.bsky.actor.getProfile com.atproto.identity.resolveHandle
lex build
```

Import the functions and generated schemas:

```typescript
import { xrpc, xrpcSafe } from '@atproto/lex'
import { app, com } from './lexicons/index.js'
```

### Minimal query with xrpc()

```typescript
import { xrpc } from '@atproto/lex'
import { app } from './lexicons/index.js'

const response = await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'pfrazee.com' },
  signal: AbortSignal.timeout(5000),
})

// response.success === true
// response.body is fully typed: { did, handle, displayName?, ... }
console.log(response.body.displayName)
```

### Minimal query with xrpcSafe()

```typescript
import { xrpcSafe } from '@atproto/lex'
import { com } from './lexicons/index.js'

const result = await xrpcSafe('https://bsky.network', com.atproto.identity.resolveHandle, {
  params: { handle: 'atproto.com' },
  signal: AbortSignal.timeout(5000),
})

if (result.success) {
  console.log(result.body.did) // string
} else {
  console.error(result.error, result.message)
}
```

## Core Patterns

### Pattern 1: Making a query (GET)

Queries use lexicon schemas that map to HTTP GET requests. Parameters become URL query strings automatically.

```typescript
import { xrpcSafe } from '@atproto/lex'
import { app } from './lexicons/index.js'

async function getProfile(actor: string) {
  const result = await xrpcSafe('https://api.bsky.app', app.bsky.actor.getProfile, {
    params: { actor },
    signal: AbortSignal.timeout(5000),
  })

  if (result.success) {
    return result.body
    // result.body type: {
    //   did: string
    //   handle: string
    //   displayName?: string
    //   description?: string
    //   avatar?: string
    //   banner?: string
    //   followersCount?: number
    //   followsCount?: number
    //   postsCount?: number
    //   ...
    // }
  }

  // result is XrpcFailure -- handle below
  if (result.shouldRetry()) {
    // Transient error, safe to retry
    throw result // or implement retry logic
  }

  throw result
}
```

### Pattern 2: Making a procedure call (POST)

Procedures use lexicon schemas that map to HTTP POST requests. The `body` is JSON-serialized automatically when the schema declares `application/json` input encoding.

```typescript
import { xrpcSafe } from '@atproto/lex'
import { com } from './lexicons/index.js'

async function createSession(identifier: string, password: string) {
  const result = await xrpcSafe('https://bsky.social', com.atproto.server.createSession, {
    body: { identifier, password },
    signal: AbortSignal.timeout(10000),
  })

  if (result.success) {
    return {
      accessJwt: result.body.accessJwt,
      refreshJwt: result.body.refreshJwt,
      did: result.body.did,
      handle: result.body.handle,
    }
  }

  throw result
}
```

### Pattern 3: Handling errors with typed discrimination

`XrpcFailure` is a union of three error classes. Use `instanceof` to discriminate between them.

```typescript
import {
  xrpcSafe,
  XrpcResponseError,
  XrpcUpstreamError,
  XrpcInternalError,
  XrpcFetchError,
} from '@atproto/lex'
import { app } from './lexicons/index.js'

async function getProfileSafe(actor: string) {
  const result = await xrpcSafe('https://api.bsky.app', app.bsky.actor.getProfile, {
    params: { actor },
    signal: AbortSignal.timeout(5000),
  })

  if (result.success) {
    return result.body
  }

  // -- Discriminate failure types --

  if (result instanceof XrpcResponseError) {
    // Server returned a valid XRPC error response (non-2xx with JSON error payload).
    // result.status  -- HTTP status code (number)
    // result.error   -- error code string (e.g. 'AccountNotFound')
    // result.message -- human-readable message
    // result.headers -- response Headers

    // Check if the error matches the method's declared error schema:
    if (result.matchesSchemaErrors()) {
      // result.error is now narrowed to the method's declared error codes
      console.error(`Schema error: ${result.error}`)
    }

    // Check retryability based on HTTP status code:
    if (result.shouldRetry()) {
      // Status was 408, 425, 429, 500, 502, 503, 504, 522, or 524
      console.log('Transient server error, retrying...')
    }

    return null
  }

  if (result instanceof XrpcUpstreamError) {
    // Server returned a response that does not conform to XRPC protocol.
    // Examples: wrong Content-Type, invalid JSON, schema validation failure.
    // result.error is always 'UpstreamFailure'.
    // result.response -- the raw Response object
    // result.shouldRetry() -- true if status is in RETRYABLE_HTTP_STATUS_CODES
    console.error('Upstream returned invalid XRPC response')
    return null
  }

  if (result instanceof XrpcFetchError) {
    // Network-level failure: DNS, connection refused, timeout, abort.
    // Subclass of XrpcInternalError.
    // result.shouldRetry() always returns true (optimistically retryable).
    console.error('Network error:', result.message)
    return null
  }

  if (result instanceof XrpcInternalError) {
    // Unexpected client-side error during request processing.
    // result.error is always 'InternalServerError'.
    // result.shouldRetry() always returns false.
    console.error('Internal error:', result.message)
    return null
  }

  // Exhaustive -- all XrpcFailure subtypes handled above
  return null
}
```

#### XrpcFailure union summary

| Class                    | `.error` value          | `.shouldRetry()`                      | When it happens                                    |
|--------------------------|-------------------------|---------------------------------------|----------------------------------------------------|
| `XrpcResponseError`      | Server error code       | `true` if status in retryable set     | Server returned valid XRPC error JSON              |
| `XrpcAuthenticationError`| Server error code       | Always `false`                        | 401 Unauthorized (subclass of XrpcResponseError)   |
| `XrpcUpstreamError`      | `'UpstreamFailure'`     | `true` if status in retryable set     | Response did not conform to XRPC protocol          |
| `XrpcInvalidResponseError`| `'UpstreamFailure'`    | `true` if status in retryable set     | Response failed schema validation (subclass)       |
| `XrpcInternalError`      | `'InternalServerError'` | Always `false`                        | Unexpected client-side error                       |
| `XrpcFetchError`         | `'InternalServerError'` | Always `true` (optimistic)            | Network error, DNS failure, timeout, abort         |

Retryable HTTP status codes: `408`, `425`, `429`, `500`, `502`, `503`, `504`, `522`, `524`.

## Common Mistakes

### Mistake 1 (HIGH): Using xrpc() without error handling

`xrpc()` throws an `XrpcFailure` on any non-success response. Forgetting try/catch creates unhandled rejections. Prefer `xrpcSafe()` for explicit error handling.

```typescript
// WRONG -- unhandled rejection if request fails
const response = await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
})

// CORRECT -- errors returned as values
const result = await xrpcSafe('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
  signal: AbortSignal.timeout(5000),
})

if (result.success) {
  console.log(result.body.displayName)
} else {
  console.error(`Failed: ${result.error} -- ${result.message}`)
}
```

### Mistake 2 (HIGH): Not using AbortSignal for timeouts

There is no default timeout. Without `AbortSignal.timeout()`, requests hang indefinitely on network issues or unresponsive servers.

```typescript
// WRONG -- hangs forever if server is unresponsive
await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
})

// CORRECT -- times out after 5 seconds
await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
  signal: AbortSignal.timeout(5000),
})
```

### Mistake 3 (MEDIUM): Passing body with query methods

Query methods map to HTTP GET. Passing `body` or setting `content-type` headers causes a `400 InvalidRequest` or a `TypeError` from the client. Only procedure methods accept a body.

```typescript
// WRONG -- getProfile is a query (GET), body is not allowed
await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
  body: { extra: 'data' }, // TypeError: type system prevents this
})

// CORRECT -- queries only take params
await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
})
```

### Mistake 4 (MEDIUM): Ignoring shouldRetry() for transient errors

Not all failures are permanent. Network blips, rate limits, and temporary server issues are retryable. Use `shouldRetry()` to decide.

```typescript
// WRONG -- treats all errors the same
const result = await xrpcSafe('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
  signal: AbortSignal.timeout(5000),
})
if (!result.success) {
  throw new Error('Request failed permanently')
}

// CORRECT -- distinguish transient from permanent failures
const result2 = await xrpcSafe('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
  signal: AbortSignal.timeout(5000),
})
if (!result2.success) {
  if (result2.shouldRetry()) {
    // Implement retry with backoff
    console.log('Transient error, will retry...')
  } else {
    // Permanent failure -- do not retry
    console.error(`Permanent failure: ${result2.error}`)
  }
}
```

### Tension: Type safety vs. runtime performance

`validateResponse` defaults to `true` -- every response is checked against the lexicon output schema at runtime. This catches schema mismatches between client and server but costs CPU. `validateRequest` defaults to `false` -- input validation is skipped for performance since the type system already constrains inputs at compile time.

Override when appropriate:

```typescript
// Development: validate both directions
await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
  validateRequest: true,
  validateResponse: true,
  signal: AbortSignal.timeout(5000),
})

// High-throughput production: skip response validation if you trust the server
await xrpc('https://api.bsky.app', app.bsky.actor.getProfile, {
  params: { actor: 'alice.bsky.social' },
  validateResponse: false,
  signal: AbortSignal.timeout(5000),
})
```

### Tension: Simple xrpc() vs. Client abstraction

`xrpc()` / `xrpcSafe()` are low-level: one request, one response, no session management. The `Client` class adds authentication, session refresh, record CRUD, and labeler configuration. Use `xrpc()` for unauthenticated or one-off requests; use `Client` for anything requiring a session.

## See also

- **client-api** -- `Client` class for authenticated sessions, record CRUD, and session management
- `@atproto/lex` README -- full library documentation including data model, validation, and advanced usage
- `CallOptions` type in `@atproto/lex` -- `signal`, `headers`, `validateRequest`, `validateResponse`, `labelers`, `service`
