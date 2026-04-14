---
name: server-setup
description: >
  Building AT Protocol XRPC servers with @atproto/lex-server. LexRouter for
  registering query, procedure, subscription handlers. Service authentication
  JWT Bearer validation, DID document refresh, lxm claim. WebSocket
  subscription lifecycle, upgradeWebSocket. LexServerError, LexServerAuthError.
  Node.js HTTP adapter. Error hooks: onHandlerError, onSocketError.
type: core
library: '@atproto/lex-server'
library_version: '0.0.12'
requires:
  - atproto-lex/data-validation
sources:
  - 'bluesky-social/atproto:packages/lex/lex-server/src/lex-router.ts'
  - 'bluesky-social/atproto:packages/lex/lex-server/src/errors.ts'
  - 'bluesky-social/atproto:packages/lex/lex-server/src/service-auth.ts'
  - 'bluesky-social/atproto:packages/lex/lex-server/src/nodejs.ts'
---

> **Prerequisite:** This skill builds on [atproto-lex/data-validation](../data-validation/SKILL.md).

## Setup

Create a `LexRouter`, register a query handler, and start a Node.js HTTP server.

```typescript
import { LexRouter } from '@atproto/lex-server'
import { serve, upgradeWebSocket } from '@atproto/lex-server/nodejs'

// Import a Lexicon namespace definition (generated from your .json lexicon files)
import { getProfile } from './lexicons/app/bsky/actor/getProfile.js'

// 1. Create a router with WebSocket support for Node.js
const router = new LexRouter({
  upgradeWebSocket,
  onHandlerError: async ({ error, request, method }) => {
    console.error(`[${method.nsid}] Handler error:`, error.message)
  },
  onSocketError: ({ error, method }) => {
    console.error(`[${method.nsid}] WebSocket error:`, error)
  },
  healthCheck: async () => ({ status: 'ok', version: '1.0.0' }),
})

// 2. Register a query handler (serves GET /xrpc/app.bsky.actor.getProfile)
router.add(getProfile, async (ctx) => {
  const profile = await db.getProfile(ctx.params.actor)
  if (!profile) {
    throw new LexServerError(404, {
      error: 'ProfileNotFound',
      message: `Profile not found: ${ctx.params.actor}`,
    })
  }
  return { body: profile }
})

// 3. Start the server
const server = await serve(router, { port: 3000 })
console.log('XRPC server listening on port 3000')

// Graceful shutdown
process.on('SIGTERM', () => server.terminate())
process.on('SIGINT', () => server.terminate())
```

The `serve` function creates a Node.js HTTP server, binds it to the given port,
and returns a `Server` instance with a `terminate()` method for graceful
shutdown. The server also implements `AsyncDisposable`:

```typescript
async function main() {
  await using server = await serve(router, { port: 3000 })

  // Server is running; wait for shutdown signal
  await Promise.race([
    once(process, 'SIGINT'),
    once(process, 'SIGTERM'),
  ])
  // server.terminate() called automatically when scope exits
}
```

If you need more control, use `createServer` instead of `serve`:

```typescript
import { createServer, upgradeWebSocket } from '@atproto/lex-server/nodejs'

const server = createServer(router, {
  gracefulTerminationTimeout: 15_000, // 15 seconds
})
server.listen(3000, '0.0.0.0', () => {
  console.log('Listening on 0.0.0.0:3000')
})
```

You can also convert the router to a plain Node.js request listener for use with
Express or other frameworks:

```typescript
import { toRequestListener } from '@atproto/lex-server/nodejs'

const app = express()
app.use('/xrpc', toRequestListener(router.fetch))
```

## Core Patterns

### Registering Procedure Handlers

Procedures handle POST requests and accept an input body. Register with or
without authentication:

```typescript
import { LexRouter, LexServerError, LexServerAuthError } from '@atproto/lex-server'
import { createPost } from './lexicons/app/bsky/feed/createPost.js'
import { deleteRecord } from './lexicons/com/atproto/repo/deleteRecord.js'

// Procedure without auth (credentials type is void)
router.add(deleteRecord, async (ctx) => {
  await db.deleteRecord(ctx.input.body.uri)
  return { body: undefined }
})

// Procedure with auth
router.add(createPost, {
  auth: async ({ request }) => {
    const token = request.headers.get('authorization')?.slice(7)
    if (!token) {
      throw new LexServerAuthError(
        'AuthenticationRequired',
        'Bearer token required',
        { Bearer: { error: 'MissingBearer' } },
      )
    }
    const session = await verifyAccessToken(token)
    return { did: session.did, scope: session.scope }
  },
  handler: async (ctx) => {
    // ctx.credentials has type { did: string; scope: string }
    const post = await db.createPost(ctx.credentials.did, ctx.input.body)
    return {
      body: { uri: post.uri, cid: post.cid },
      headers: { 'X-Request-Id': crypto.randomUUID() },
    }
  },
})
```

Handlers can return a raw `Response` object for full control:

```typescript
router.add(getBlob, async (ctx) => {
  const stream = await blobStore.getStream(ctx.params.cid)
  return new Response(stream, {
    headers: { 'Content-Type': 'application/octet-stream' },
  })
})
```

The `LexRouter.add` method returns `this`, so calls can be chained:

```typescript
router
  .add(getProfile, profileHandler)
  .add(createPost, { handler: postHandler, auth: tokenAuth })
  .add(deleteRecord, deleteHandler)
```

### WebSocket Subscription Setup

Subscriptions use async generators to yield messages over WebSocket. The
`upgradeWebSocket` function is required in Node.js environments.

```typescript
import { LexRouter } from '@atproto/lex-server'
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'
import { subscribeRepos } from './lexicons/com/atproto/sync/subscribeRepos.js'

const router = new LexRouter({
  upgradeWebSocket,
  // Backpressure control for WebSocket writes
  highWaterMark: 64 * 1024,  // 64 KB - pause when buffer exceeds this
  lowWaterMark: 16 * 1024,   // 16 KB - resume when buffer drops below this
  // Required to avoid unhandled promise rejections from iterator cleanup
  onSocketError: ({ error, method }) => {
    console.error(`[${method.nsid}] Socket error:`, error)
  },
})

router.add(subscribeRepos, async function* (ctx) {
  const cursor = ctx.params.cursor ?? 0

  for await (const event of eventStream.since(cursor)) {
    // Check abort signal to stop when client disconnects
    if (ctx.signal.aborted) break

    yield event
    // Messages are CBOR-encoded as DAG-CBOR frames automatically.
    // If event has a $type field like 'com.atproto.sync.subscribeRepos#commit',
    // the NSID prefix is stripped in the frame header's `t` field.
  }
  // When the generator returns, the WebSocket closes with code 1000.
})
```

WebSocket close codes used by the router:
- **1000** - Normal closure (generator completed)
- **1003** - Client sent a message (subscriptions are server-push only)
- **1008** - Known `LexError` whose error code is in `method.errors`
- **1011** - Unknown/unexpected error

Subscription with authentication:

```typescript
router.add(subscribeRepos, {
  auth: async ({ request, params }) => {
    const token = request.headers.get('authorization')?.slice(7)
    return token ? await verifyServiceToken(token) : { anonymous: true }
  },
  handler: async function* (ctx) {
    if (ctx.credentials.anonymous && !isPublicSubscription(ctx.params)) {
      throw new LexServerError(401, {
        error: 'AuthenticationRequired',
        message: 'Authentication required for filtered subscriptions',
      })
    }
    for await (const event of eventStream.since(ctx.params.cursor)) {
      if (ctx.signal.aborted) break
      yield event
    }
  },
})
```

### Service Auth with JWT Validation

AT Protocol service-to-service authentication uses signed JWT bearer tokens
verified against the caller's DID document.

```typescript
import { LexRouter, serviceAuth } from '@atproto/lex-server'
import { serve, upgradeWebSocket } from '@atproto/lex-server/nodejs'
import { getRecord } from './lexicons/com/atproto/repo/getRecord.js'

const auth = serviceAuth({
  // Your service's DID - tokens must include this as the "aud" claim
  audience: 'did:web:api.example.com',

  // Nonce uniqueness checker to prevent replay attacks.
  // Must return true if the nonce has never been seen before.
  unique: async (nonce) => {
    const key = `nonce:${nonce}`
    const isNew = await redis.setnx(key, '1')
    if (isNew) await redis.expire(key, 600) // 10 min TTL
    return Boolean(isNew)
  },

  // Maximum token age in seconds (default: 300 = 5 minutes)
  maxAge: 300,

  // Optional: custom PLC directory URL
  plcDirectoryUrl: 'https://plc.directory',
})

const router = new LexRouter({ upgradeWebSocket })

router.add(getRecord, {
  auth,
  handler: async (ctx) => {
    // ctx.credentials is ServiceAuthCredentials:
    //   { did: AtprotoDid, didDocument: AtprotoDidDocument, jwt: ParsedJwt }
    console.log('Authenticated caller:', ctx.credentials.did)
    console.log('Token lxm claim:', ctx.credentials.jwt.payload.lxm)

    const record = await db.getRecord(ctx.params.repo, ctx.params.collection)
    return { body: record }
  },
})

const server = await serve(router, { port: 3000 })
```

The `serviceAuth` handler performs these validations in order:

1. Extracts Bearer token from the `Authorization` header
2. Parses and validates JWT structure (header, payload, signature segments)
3. Rejects forbidden token types (`alg: 'none'`, `typ: 'at+jwt'`, `typ: 'refresh+jwt'`, `typ: 'dpop+jwt'`)
4. Checks `aud` claim matches the configured `audience`
5. Validates time claims: `nbf` (not before), `exp` (expiry), `iat`/`exp` within `maxAge`
6. Validates `lxm` claim matches the called method's NSID
7. Resolves the issuer's DID document and verifies the JWT signature against the `#atproto` verification method
8. On first signature failure, refreshes the DID document and retries verification (handles key rotation)
9. Checks nonce uniqueness via the `unique` callback

## Common Mistakes

### 1. Not providing `upgradeWebSocket` for subscriptions (HIGH)

On Node.js, the `LexRouter` constructor does not have access to WebSocket
upgrade capabilities by default. If you register a subscription handler without
passing `upgradeWebSocket`, the router throws a `TypeError` at the time the
handler is registered (not at request time).

```typescript
// WRONG - throws TypeError: "WebSocket upgrade not supported in this environment..."
const router = new LexRouter()
router.add(subscribeRepos, async function* (ctx) {
  yield event
})

// CORRECT
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'

const router = new LexRouter({ upgradeWebSocket })
router.add(subscribeRepos, async function* (ctx) {
  yield event
})
```

On Deno, `upgradeWebSocket` is available globally and used automatically.
Source: `lex-router.ts:784-788`

### 2. Registering duplicate XRPC methods (MEDIUM)

Calling `router.add()` with the same NSID twice throws a `TypeError`. This can
happen when re-registering methods during hot reload or when two modules
register the same method.

```typescript
// WRONG - throws TypeError: "Method app.bsky.actor.getProfile already registered"
router.add(getProfile, handler1)
router.add(getProfile, handler2)  // TypeError

// CORRECT - use a single registration, or create a new router
const router = new LexRouter({ upgradeWebSocket })
router.add(getProfile, handler2)
```

If you need to check whether a method is already registered:

```typescript
if (!router.handlers.has('app.bsky.actor.getProfile')) {
  router.add(getProfile, handler)
}
```

Source: `lex-router.ts:673-675`

### 3. Not handling iterator cleanup errors (HIGH)

When a WebSocket subscription closes, the router calls `iterator.return()` on
the async generator to clean up resources. If `iterator.return()` throws and
no `onSocketError` hook is provided, the error becomes an unhandled promise
rejection, which crashes the Node.js process.

```typescript
// WRONG - iterator cleanup errors will crash the process
const router = new LexRouter({ upgradeWebSocket })
router.add(subscribeRepos, async function* (ctx) {
  const stream = db.createChangeStream()
  try {
    for await (const change of stream) {
      if (ctx.signal.aborted) break
      yield change
    }
  } finally {
    // If this throws, and no onSocketError is set, process crashes
    await stream.close()
  }
})

// CORRECT - provide onSocketError to catch cleanup errors
const router = new LexRouter({
  upgradeWebSocket,
  onSocketError: ({ error, method }) => {
    console.error(`[${method.nsid}] Socket cleanup error:`, error)
  },
})
```

Alternatively, guard the cleanup code itself:

```typescript
router.add(subscribeRepos, async function* (ctx) {
  const stream = db.createChangeStream()
  try {
    for await (const change of stream) {
      if (ctx.signal.aborted) break
      yield change
    }
  } finally {
    try {
      await stream.close()
    } catch (err) {
      console.error('Failed to close change stream:', err)
    }
  }
})
```

Source: `lex-router.ts:851-864`

### 4. Accepting JWT with `alg:none` or invalid `typ` (CRITICAL)

The `serviceAuth` handler rejects tokens with these header values:
- `alg: 'none'` -- unsigned tokens (security vulnerability)
- `typ: 'at+jwt'` -- OAuth 2.0 access tokens (RFC 9068)
- `typ: 'refresh+jwt'` -- AT Protocol refresh tokens
- `typ: 'dpop+jwt'` -- DPoP proof tokens (RFC 9449)

If you implement custom auth instead of using `serviceAuth`, you must enforce
these same checks. Accepting any of these token types allows cross-protocol
token confusion attacks.

```typescript
// WRONG - custom auth that does not check token type
const unsafeAuth = async ({ request }) => {
  const token = request.headers.get('authorization')?.slice(7)
  const decoded = decodeJwt(token) // Does not reject alg:none or bad typ
  return { did: decoded.iss }
}

// CORRECT - use serviceAuth which handles all validation
import { serviceAuth } from '@atproto/lex-server'

const auth = serviceAuth({
  audience: 'did:web:api.example.com',
  unique: checkNonce,
})
```

Source: `service-auth.ts:379-395`

## Additional Error Handling Details

- `LexServerError.from()` converts `XrpcError` (from `@atproto/lex-client`),
  `LexValidationError` (from `@atproto/lex-schema`), and generic `LexError`
  into standardized error responses automatically.
- `LexServerAuthError` always returns HTTP 401 with a `WWW-Authenticate` header
  and an `Access-Control-Expose-Headers: WWW-Authenticate` header for CORS.
- A query (GET) request with a body, `Content-Type`, or `Content-Length` header
  returns 400 `InvalidRequest` with message "GET requests must not have a body".
- Abort errors (client disconnect) return HTTP 499 without calling the
  `onHandlerError` hook.

---

See also: [atproto-lex/data-validation](../data-validation/SKILL.md) for input/output schema validation, Lexicon type definitions, and data encoding.
