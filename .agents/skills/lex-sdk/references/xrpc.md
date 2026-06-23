# Low-level XRPC: `xrpc()` and `xrpcSafe()`

`xrpc` and `xrpcSafe` make typed XRPC requests against a service URL
without a `Client` instance. Use them when:

- You don't have an authenticated session.
- You need granular control over a single request.
- You're calling a service from inside another service (e.g. AppView →
  feed generator).

For session-bound calls, prefer the higher-level [`Client`](client.md).

## Schema overview

XRPC has three method types defined by Lexicon:

- **Queries** — HTTP GET. Read operations. Take `params`.
- **Procedures** — HTTP POST. Mutations. Take `input` (body).
- **Subscriptions** — WebSockets. Real-time streams.

```
GET  /xrpc/<nsid>?<params>     — query
POST /xrpc/<nsid>              — procedure
WS   /xrpc/<nsid>              — subscription
```

## `xrpc()` — throws on error

```ts
import { xrpc } from '@atproto/lex'
import { com } from './lexicons/index.js'

const response = await xrpc(
  'https://bsky.network',
  com.atproto.identity.resolveHandle,
  {
    params: { handle: 'atproto.com' },
    headers: { 'user-agent': 'MyApp/1.0.0' },
  },
)

response.status // number
response.headers // Headers (standard Web API)
response.body.did // typed: `did:${string}:${string}`
```

For procedures, pass the body as `input`:

```ts
await xrpc('https://example.com', someProcedure, {
  input: {
    /* ... */
  },
  headers: {
    /* ... */
  },
})
```

## `xrpcSafe()` — discriminated result

`xrpcSafe()` returns a result union instead of throwing — useful when
errors are expected as part of the contract.

```ts
import { xrpcSafe } from '@atproto/lex'

const result = await xrpcSafe(
  'https://bsky.network',
  com.atproto.identity.resolveHandle,
  {
    params: { handle: 'atproto.com' },
    signal: AbortSignal.timeout(5000),
  },
)

if (result.success) {
  result.body // typed body
  result.headers // Headers
  result.status // number
} else {
  result.error // XRPC error code (string)
  result.message // human-readable message
  result.shouldRetry() // boolean (transient?)
}
```

## Request options

Common options on both `xrpc` and `xrpcSafe`:

| Option                     | Type                                  | Effect                                                             |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| `params`                   | object                                | Query/procedure params (merged with method schema)                 |
| `input`                    | object                                | Procedure body                                                     |
| `headers`                  | `Record<string, string>` or `Headers` | Extra headers                                                      |
| `signal`                   | `AbortSignal`                         | Cancel the request                                                 |
| `validateRequest`          | `boolean`                             | Validate body before send (default `false`)                        |
| `validateResponse`         | `boolean`                             | Validate response body (default `true`)                            |
| `strictResponseProcessing` | `boolean`                             | Strict Lex decoding (default `true`; see [schemas.md](schemas.md)) |

## Error types

`xrpcSafe()`'s failure branch is a union of three classes (also thrown by
`xrpc()`):

```ts
import {
  XrpcResponseError,
  XrpcInvalidResponseError,
  XrpcResponseValidationError,
  XrpcInternalError,
} from '@atproto/lex'
```

### `XrpcResponseError`

Server returned a 4xx/5xx. This is the normal "the server said no" error.

```ts
err.error // string — XRPC error code (e.g. 'HandleNotFound')
err.message // string
err.response.status // number
err.response.headers // Headers
err.payload // undefined | { body: unknown; encoding: string }
err.toJSON() // { error: string, message?: string }
err.shouldRetry() // boolean — e.g. true for 429/5xx
```

Pattern-match against declared schema errors:

```ts
if (result.matchesSchemaErrors()) {
  // TypeScript narrows `result.error` to the schema's declared error names
  if (result.error === 'HandleNotFound') {
    /* ... */
  }
}
```

### `XrpcInvalidResponseError`

Response was 2xx/3xx but doesn't comply with XRPC (3xx redirect, malformed
JSON, schema mismatch). `error` is always `'UpstreamFailure'`.
`XrpcResponseValidationError` is a subclass for schema validation failures
specifically.

### `XrpcInternalError`

Client-side failure — network error, timeout, etc. `error` is always
`'InternalServerError'`.

## Common patterns

### Bounded retries with `shouldRetry()`

```ts
for (let attempt = 0; attempt < 3; attempt++) {
  const result = await xrpcSafe(url, schema, { params })
  if (result.success) return result.body
  if (!result.shouldRetry()) throw result.reason ?? result
}
```

### Replacing legacy try/catch with `XRPCError`

```ts
// Old (@atproto/xrpc):
try {
  const result = await agent.api.app.bsky.feed.getFeedSkeleton(params, {
    headers,
  })
  skeleton = result.data
} catch (err) {
  if (err instanceof AppBskyFeedGetFeedSkeleton.UnknownFeedError) {
    /* ... */
  }
  if (err instanceof XRPCError) {
    if (err.status === ResponseType.Unknown) {
      /* ... */
    }
  }
  throw err
}

// New (@atproto/lex):
const result = await xrpcSafe(fgEndpoint, app.bsky.feed.getFeedSkeleton, {
  headers,
  params,
})
if (!result.success) {
  if (result.matchesSchemaErrors()) {
    throw new InvalidRequestError(result.message, result.error)
  }
  if (result.error === 'UpstreamFailure') {
    /* ... */
  }
  throw result.reason
}
const body = result.body
```

## Headers — standard `Headers` API

Response headers are a standard `Headers` object, not a plain map. Use
`.get()`:

```ts
const lang = result.headers.get('content-language') ?? undefined
```

When you need the legacy header-map shape (e.g. forwarding response
headers from a service to a client), `@atproto/xrpc-server` exports a
`Headers` type alias that some callers import as `HeadersMap`:

```ts
import { Headers as HeadersMap } from '@atproto/xrpc-server'
```

(The alias avoids confusion with the global `Headers` type.)

## When to choose `xrpc` vs `Client.xrpc` vs `Client.call`

| Goal                                                       | Use                                      |
| ---------------------------------------------------------- | ---------------------------------------- |
| Stateless service-to-service call, no auth                 | `xrpc()` / `xrpcSafe()`                  |
| Authenticated session, want full response (headers/status) | `client.xrpc()` ([client.md](client.md)) |
| Authenticated session, just want body or error             | `client.call()`                          |
| Authenticated session, structured error handling           | `client.xrpcSafe()`                      |
