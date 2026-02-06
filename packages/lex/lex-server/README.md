# @atproto/lex-server

Request router for Atproto Lexicon protocols and schemas. See the [Changelog](./CHANGELOG.md) for version history.

```bash
npm install @atproto/lex-server
```

- Type-safe request routing based on Lexicon schemas
- Support for queries, procedures, and WebSocket subscriptions
- Built on Web standard `Request`/`Response` APIs (portable across runtimes)
- Custom authentication with credential passing
- Graceful shutdown with `AsyncDisposable` pattern

> [!IMPORTANT]
>
> This package is currently in **preview**. The API and features are subject to change before the stable release.

**What is this?**

Building AT Protocol servers requires handling XRPC requests, validating inputs against Lexicon schemas, managing authentication, and supporting real-time subscriptions. `@atproto/lex-server` automates this by:

1. Routing requests to type-safe handlers based on Lexicon schemas
2. Automatically validating request parameters and bodies
3. Providing a flexible authentication system with custom strategies
4. Supporting WebSocket subscriptions with backpressure handling

```typescript
import { LexRouter } from '@atproto/lex-server'
import { serve, upgradeWebSocket } from '@atproto/lex-server/nodejs'
import * as app from './lexicons/app.js'

const router = new LexRouter({ upgradeWebSocket })
  .add(app.bsky.actor.getProfile, async ({ params }) => {
    const profile = await db.getProfile(params.actor)
    return { body: profile }
  })
  .add(app.bsky.feed.post.create, {
    auth: requireAuth,
    handler: async ({ credentials, input }) => {
      const result = await db.createPost(credentials.did, input.body)
      return { body: result }
    },
  })

await serve(router, { port: 3000 })
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Quick Start](#quick-start)
- [LexRouter](#lexrouter)
  - [Creating a Router](#creating-a-router)
  - [Adding Routes](#adding-routes)
  - [Handler Context](#handler-context)
  - [Handler Output](#handler-output)
- [Queries and Procedures](#queries-and-procedures)
  - [Query Handler](#query-handler)
  - [Procedure Handler](#procedure-handler)
  - [Binary Payloads](#binary-payloads)
- [Subscriptions](#subscriptions)
- [Authentication](#authentication)
  - [Custom Authentication](#custom-authentication)
  - [WWW-Authenticate Headers](#www-authenticate-headers)
- [Error Handling](#error-handling)
  - [LexError](#lexerror)
  - [LexServerAuthError](#lexserverautherror)
  - [Error Handler Callback](#error-handler-callback)
- [Node.js Server](#nodejs-server)
  - [serve()](#serve)
  - [createServer()](#createserver)
  - [toRequestListener()](#torequestlistener)
  - [upgradeWebSocket()](#upgradewebsocket)
- [Advanced Usage](#advanced-usage)
  - [Custom Response Objects](#custom-response-objects)
  - [Response Headers](#response-headers)
  - [Connection Info](#connection-info)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Quick Start

**1. Install the package**

```bash
npm install @atproto/lex-server
```

**2. Generate Lexicon schemas**

Use `@atproto/lex` to generate TypeScript schemas from your Lexicon definitions:

```bash
lex install app.bsky.actor.getProfile
lex build
```

**3. Create a router and add handlers**

```typescript
import { LexRouter, LexError } from '@atproto/lex-server'
import { serve, upgradeWebSocket } from '@atproto/lex-server/nodejs'
import * as app from './lexicons/app.js'

const router = new LexRouter({ upgradeWebSocket })

// Add a query handler
router.add(app.bsky.actor.getProfile, async ({ params }) => {
  const profile = await db.getProfile(params.actor)
  if (!profile) {
    throw new LexError('NotFound', 'Profile not found')
  }
  return { body: profile }
})

// Start the server
const server = await serve(router, { port: 3000 })
console.log('Server listening on port 3000')
```

## LexRouter

The `LexRouter` class is the core of `@atproto/lex-server`. It routes XRPC requests to type-safe handlers based on Lexicon schemas.

### Creating a Router

```typescript
import { LexRouter } from '@atproto/lex-server'
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'

const router = new LexRouter({
  // Required for WebSocket subscriptions (Node.js)
  upgradeWebSocket,

  // Optional: Handle unexpected errors
  onHandlerError: ({ error, request, method }) => {
    console.error(`Error in ${method.nsid}:`, error)
  },

  // Optional: WebSocket backpressure settings
  highWaterMark: 250_000, // bytes (default: 250KB)
  lowWaterMark: 50_000, // bytes (default: 50KB)
})
```

### Adding Routes

Routes are added using the `.add()` method, which accepts a Lexicon schema and a handler:

```typescript
// Simple handler (no authentication)
router.add(schema, async ({ params, input, request }) => {
  return { body: result }
})

// Handler with authentication
router.add(schema, {
  auth: async ({ request, params }) => credentials,
  handler: async ({ params, input, credentials, request }) => {
    return { body: result }
  },
})
```

The router supports method chaining:

```typescript
const router = new LexRouter()
  .add(app.bsky.actor.getProfile, profileHandler)
  .add(app.bsky.feed.getTimeline, timelineHandler)
  .add(app.bsky.feed.post.create, postHandler)
```

### Handler Context

Handlers receive a context object with the following properties:

```typescript
type LexRouterHandlerContext<Method, Credentials> = {
  credentials: Credentials // Result of auth function (undefined if no auth)
  input: InferMethodInput<Method> // Parsed request body (procedures only)
  params: InferMethodParams<Method> // Parsed URL query parameters
  request: Request // Original Web Request object
  connection?: ConnectionInfo // Network connection info
}
```

### Handler Output

Handlers can return various output formats:

```typescript
// JSON response (encoding inferred from schema)
return { body: { key: 'value' } }

// With custom encoding
return { encoding: 'text/plain', body: 'Hello, world!' }

// With response headers
return { body: data, headers: { 'x-custom': 'value' } }

// Empty response (200 OK with no body)
return {}

// Custom Response object (full control)
return new Response(body, { status: 201, headers })

// Proxy Response
return fetch('https://example.com/data')
```

## Queries and Procedures

### Query Handler

Queries handle `GET` requests and receive parameters from the URL query string:

```typescript
import * as app from './lexicons/app.js'

router.add(app.bsky.actor.getProfile, async ({ params }) => {
  // params.actor is typed and validated
  const profile = await db.getProfile(params.actor)
  return { body: profile }
})
```

### Procedure Handler

Procedures handle `POST` requests and receive a request body:

```typescript
router.add(app.bsky.feed.post.create, async ({ input }) => {
  // input.body contains the parsed and validated request body
  const post = await db.createPost(input.body)
  return { body: { uri: post.uri, cid: post.cid } }
})
```

### Binary Payloads

For endpoints that accept or return binary data:

```typescript
// Binary input
router.add(app.example.uploadBlob, async ({ input }) => {
  // input.body is a Request object for streaming
  // input.encoding contains the content-type
  const blob = await input.body.arrayBuffer()
  return { body: { cid: await store(blob) } }
})

// Binary output
router.add(app.example.getBlob, async ({ params }) => {
  const stream = await getBlob(params.cid)
  return {
    encoding: 'application/octet-stream',
    body: stream,
  }
})
```

## Subscriptions

Subscriptions provide real-time data over WebSocket connections. Handlers are async generators that yield messages:

```typescript
import { LexRouter, LexError } from '@atproto/lex-server'
import { serve, upgradeWebSocket } from '@atproto/lex-server/nodejs'
import { scheduler } from 'node:timers/promises'

const router = new LexRouter({
  upgradeWebSocket, // Required for WebSocket support in nodejs
})

router.add(com.example.stream, async function* ({ params, request }) {
  const { cursor = 0, limit = 10 } = params
  const { signal } = request

  for (let i = 0; i < limit; i++) {
    // Yield messages to the client
    yield com.example.stream.message.$build({
      data: `Message ${cursor + i}`,
      cursor: cursor + i,
    })

    // Wait between messages (respects abort signal)
    await scheduler.wait(1000, { signal })
  }

  // Throwing a LexError closes the connection with an error frame
  throw new LexError('LimitReached', `Limit of ${limit} messages reached`)
})
```

Messages are CBOR-encoded and sent as WebSocket binary frames. The router handles:

- WebSocket upgrade negotiation
- Backpressure management
- Graceful connection cleanup
- Error frame encoding

## Authentication

### Custom Authentication

Authentication is implemented through the `auth` function in handler configs:

```typescript
import { LexError, LexServerAuthError } from '@atproto/lex-server'

type Credentials = { did: string; scope: string[] }

const requireAuth = async ({
  request,
}: {
  request: Request
}): Promise<Credentials> => {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) {
    throw new LexServerAuthError(
      'AuthenticationRequired',
      'Bearer token required',
      {
        Bearer: { realm: 'api' },
      },
    )
  }

  const token = header.slice(7)
  const session = await verifyToken(token)
  if (!session) {
    throw new LexServerAuthError(
      'InvalidToken',
      'Token is invalid or expired',
      {
        Bearer: { realm: 'api', error: 'invalid_token' },
      },
    )
  }

  return { did: session.did, scope: session.scope }
}

// Use with handlers
router.add(app.bsky.feed.post.create, {
  auth: requireAuth,
  handler: async ({ credentials, input }) => {
    // credentials.did is available here
    const post = await db.createPost(credentials.did, input.body)
    return { body: post }
  },
})
```

The auth function:

1. Is called **before** parsing the request body
2. Receives `params`, `request`, and `connection` info
3. Should throw `LexError` or `LexServerAuthError` on failure
4. Returns credentials that are passed to the handler

### WWW-Authenticate Headers

Use `LexServerAuthError` to include `WWW-Authenticate` headers in error responses:

```typescript
import { LexServerAuthError } from '@atproto/lex-server'

// Simple Bearer challenge
throw new LexServerAuthError('AuthenticationRequired', 'Login required', {
  Bearer: { realm: 'api' },
})
// WWW-Authenticate: Bearer realm="api"

// Multiple schemes
throw new LexServerAuthError('AuthenticationRequired', 'Auth required', {
  Bearer: { realm: 'api', scope: 'read write' },
  Basic: { realm: 'api' },
})
// WWW-Authenticate: Bearer realm="api", scope="read write", Basic realm="api"

// Token68 format
throw new LexServerAuthError('AuthenticationRequired', 'Auth required', {
  Bearer: 'token68value',
})
// WWW-Authenticate: Bearer token68value
```

## Error Handling

### LexError

Throw `LexError` to return structured XRPC error responses:

```typescript
import { LexError } from '@atproto/lex-server'

router.add(app.bsky.actor.getProfile, async ({ params }) => {
  const profile = await db.getProfile(params.actor)
  if (!profile) {
    throw new LexError('NotFound', 'Profile not found')
  }
  return { body: profile }
})
```

Error responses follow the XRPC format:

```json
{
  "error": "NotFound",
  "message": "Profile not found"
}
```

### LexServerAuthError

`LexServerAuthError` extends `LexError` with `WWW-Authenticate` header support:

```typescript
import { LexServerAuthError } from '@atproto/lex-server'

throw new LexServerAuthError('AuthenticationRequired', 'Invalid credentials', {
  Bearer: { realm: 'api' },
})
```

This returns a 401 response with the `WWW-Authenticate` header.

### Error Handler Callback

Use `onHandlerError` to log or report unexpected errors:

```typescript
const router = new LexRouter({
  onHandlerError: async ({ error, request, method }) => {
    // Log errors (excluding expected abort signals)
    console.error(`Error in ${method.nsid}:`, error)
    await reportToSentry(error)
  },
})
```

> [!NOTE]
>
> The callback is only invoked for unexpected errors, not for `LexError` instances or request aborts.

## Node.js Server

The `@atproto/lex-server/nodejs` subpath provides Node.js-specific utilities.

### serve()

Start a server and begin listening:

```typescript
import { serve } from '@atproto/lex-server/nodejs'

const server = await serve(router, { port: 3000 })
console.log('Server listening on port 3000')

// Graceful shutdown
await server.terminate()
```

The server supports `AsyncDisposable`:

```typescript
await using server = await serve(router, { port: 3000 })
// Server is automatically terminated when scope exits
```

Options:

```typescript
type StartServerOptions = {
  port?: number
  host?: string
  gracefulTerminationTimeout?: number // ms to wait for connections to close
}
```

### createServer()

Create a server without starting it:

```typescript
import { createServer } from '@atproto/lex-server/nodejs'

const server = createServer(router, {
  gracefulTerminationTimeout: 5000,
})

server.listen(3000, () => {
  console.log('Server listening')
})
```

### toRequestListener()

Convert a handler to an Express/Connect-compatible middleware:

```typescript
import express from 'express'
import { toRequestListener } from '@atproto/lex-server/nodejs'

const app = express()

// Mount the XRPC router
app.use('/xrpc', toRequestListener(router.handle))

app.listen(3000)
```

### upgradeWebSocket()

Required for WebSocket subscription support in Node.js:

```typescript
import { LexRouter } from '@atproto/lex-server'
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'

const router = new LexRouter({ upgradeWebSocket })
```

## Advanced Usage

### Custom Response Objects

Return a `Response` object for full control over the response:

```typescript
router.add(schema, async ({ params }) => {
  if (params.redirect) {
    return Response.redirect('https://example.com', 302)
  }

  return new Response(JSON.stringify({ custom: true }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value',
    },
  })
})
```

### Response Headers

Add headers to responses:

```typescript
router.add(schema, async ({ params }) => {
  return {
    body: { data: 'value' },
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'X-Request-Id': crypto.randomUUID(),
    },
  }
})
```

### Connection Info

Access network connection information:

```typescript
router.add(schema, async ({ connection }) => {
  console.log('Remote address:', connection?.remoteAddr?.hostname)
  console.log('Local address:', connection?.localAddr?.hostname)
  return { body: { status: 'ok' } }
})
```

Connection info structure:

```typescript
type ConnectionInfo = {
  localAddr?: {
    hostname: string
    port: number
    transport: 'tcp' | 'udp'
  }
  remoteAddr?: {
    hostname: string
    port: number
    transport: 'tcp' | 'udp'
  }
}
```

## License

MIT or Apache2
