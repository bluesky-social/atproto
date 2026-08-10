---
name: xrpc-server
description: >
  Build or edit routes on an AT Protocol service that uses
  `@atproto/xrpc-server` — `packages/pds`, `packages/bsky`, or any package whose
  handlers call `server.add()`. Use when adding or changing an endpoint, wiring
  `createServer` into Express, reading params/input/auth in a handler, returning
  JSON, binary, streamed, or empty responses, setting response headers, throwing
  XRPC protocol errors, applying per-route rate limits or body limits, or
  exposing a WebSocket subscription. To migrate a service off the legacy
  generated server stack, use the lexification-server skill instead. For calls
  the service makes *out* to other services, use the lex-client skill.
disable-model-invocation: false
---

# `@atproto/xrpc-server`

The server half of the AT Protocol XRPC stack. Service code creates a `Server`
and registers endpoints by passing generated lexicon schemas to `server.add()`.

Import it directly — it is **not** re-exported by `@atproto/lex`:

```ts
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
```

This is the server package the services actually use — `@atproto/lex-server` is
a separate package that no service in this repo consumes. `packages/pds` and
`packages/bsky` are fully on `server.add()`; `packages/ozone` is still on the
legacy generated stack (see the
[lexification-server skill](../lexification-server/SKILL.md)).

Watch the casing: `XRPCError` is this package's server-side class, thrown in
handlers. `XrpcError` is the _client_-side class from `@atproto/lex-client`.

## Creating the server

```ts
import { createServer } from '@atproto/xrpc-server'

const server = createServer([], {
  validateResponse: config.debugMode,
  payload: {
    jsonLimit: 100 * 1024,
    textLimit: 100 * 1024,
    blobLimit: 5 * 1024 * 1024,
  },
})

app.use(server.router) // Express
```

The first argument is an array of legacy `LexiconDoc`s — pass `[]` for
schema-based setups. It is not middleware. Other `Options` worth knowing:
`catchall` (a fallback `RequestHandler`, used by the PDS for proxying),
`errorParser` (map non-`XRPCError` throwables onto XRPC errors before they are
rendered), and `rateLimits` (global/shared limiter wiring).

`server.router` is the Express app. Legacy generated servers expose
`server.xrpc.router` instead — if you see that, you are in legacy code.

WebSocket upgrades are wired up automatically when the server's router is
mounted on an app that later calls `.listen()`; there is nothing extra to do
for subscriptions beyond registering them.

## Registering a route

`server.add(schema, handlerOrConfig)`. The schema is the generated lexicon
object, e.g. `com.atproto.identity.resolveHandle`.

Bare-function form when the route needs nothing but a handler:

```ts
import type { Server } from '@atproto/xrpc-server'
import { com } from '../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.identity.resolveHandle, async ({ params }) => {
    const did = await resolve(params.handle)
    return { encoding: 'application/json', body: { did } }
  })
}
```

Object form for anything else — `auth`, `rateLimit`, `opts`:

```ts
server.add(app.bsky.draft.createDraft, {
  auth: ctx.authVerifier.standard,
  handler: async ({ input, auth }) => {
    const actorDid = auth.credentials.iss
    if (atLimit)
      throw new InvalidRequestError('Drafts limit reached', 'DraftLimitReached')
    return { encoding: 'application/json', body: { draft } }
  },
})
```

Registration is conditional-friendly: it is normal to `return` early when a
dependency is absent (`if (!ctx.bskyAppView) return`), or to register a
different handler for the same NSID on each branch of an `if`.

### Handler context

`{ params, input, auth, req, res, resetRouteRateLimits }`. Queries read
`params`, procedures read `input.body`; `req`/`res` are Express objects, useful
for reading request headers or setting response headers directly.

There is **no `signal`** on a method handler — only subscription handlers get
one. `resetRouteRateLimits()` clears the consumed points for this route,
e.g. after a successful login.

### Route options and rate limits

```ts
server.add(com.atproto.repo.createRecord, {
  auth: ctx.authVerifier.authorization({ authorize: () => {} }),
  rateLimit: [
    {
      name: 'repo-write-hour',
      calcKey: ({ auth }) => auth.credentials.did,
      calcPoints: () => 3,
    },
  ],
  opts: { jsonLimit: 1_000_000 },
  handler: async ({ input, auth }) => {
    /* ... */
  },
})
```

`rateLimit` is one entry or an array; `{ name }` references a shared limiter
declared in `createServer`'s `rateLimits.shared`, while `{ durationMs, points }`
declares a route-local one. `opts` is `RouteOptions` — `jsonLimit`, `textLimit`,
`blobLimit`, `paramsParseLoose` — overriding the server-wide `payload` defaults.

## Return values

A JSON response is `{ encoding, body }`, optionally with `headers`:

```ts
return {
  encoding: 'application/json',
  body: result,
  headers: { 'server-timing': serverTimingHeader([timerSkele, timerHydr]) },
}
```

Other shapes the server understands:

| Return                           | Effect                                                                   |
| -------------------------------- | ------------------------------------------------------------------------ |
| nothing (`undefined`)            | 200 with an empty body — correct for lexicons with no `output`           |
| `{ encoding, body: Readable }`   | streamed binary response                                                 |
| `{ encoding, buffer, headers? }` | `HandlerPipeThroughBuffer`                                               |
| `{ encoding, stream, headers? }` | `HandlerPipeThroughStream` — what the PDS `pipethrough()` helper returns |

Binary example, from `packages/pds/src/api/com/atproto/sync/getBlob.ts`:

```ts
res.setHeader('content-security-policy', `default-src 'none'; sandbox`)
return {
  encoding: found.mimeType || ('application/octet-stream' as const),
  body: found.stream,
}
```

Bodies are validated against the schema's output unless the server was
constructed with `validateResponse: false`.

### When `encoding` needs `as const`

Returning the object literal _directly_ from a handler that declares at least
one parameter is contextually typed by `server.add()`, so `encoding:
'application/json'` is already narrow and needs nothing — this is what most
handlers in `packages/bsky/src/api/` do.

Contextual typing is lost in two cases, and then `'application/json'` widens to
`string` and no longer matches the schema:

- the response is built into an intermediate variable before being returned
- the handler declares no parameters at all (`async () => ({ ... })`)

Fix either with `as const` on the literal, or by anchoring the whole object with
`satisfies app.bsky.graph.getRelationships.$Output`. A
`Promise<…$Output>` return-type annotation does **not** fix the
intermediate-variable case — it produces an assignability error instead.

## Errors

Throw an `XRPCError` subclass. Constructors are
`(message?, errorName?, options?)`; `errorName` should match an error declared
in the lexicon, and `options` is standard `ErrorOptions` so causes can be
chained:

```ts
throw new InvalidRequestError('Drafts limit reached', 'DraftLimitReached')
throw new InvalidRequestError('Unable to resolve handle', undefined, {
  cause: err,
})
```

| Class                       | Status |
| --------------------------- | ------ |
| `InvalidRequestError`       | 400    |
| `AuthRequiredError`         | 401    |
| `ForbiddenError`            | 403    |
| `InternalServerError`       | 500    |
| `MethodNotImplementedError` | 501    |
| `UpstreamFailureError`      | 502    |
| `NotEnoughResourcesError`   | 503    |
| `UpstreamTimeoutError`      | 504    |

`RateLimitExceededError` (429) also exists but takes a `RateLimiterStatus` as its
first argument and is thrown by the rate limiter, not by handlers.

Each subclass overrides `Symbol.hasInstance` to match on the response type
rather than the prototype chain, so `err instanceof InvalidRequestError` is true
for _any_ `XRPCError` with a 400 type, however it was constructed.

`ErrorResult` (`{ status, error?, message? }`) is the non-throwing counterpart,
returned by auth verifiers; `excludeErrorResult(v)` converts one back into a
thrown `XRPCError`.

## Schema accessors inside handlers

The schema object is in scope — use its accessors instead of NSID string
literals (see [STYLE_GUIDE.md](../../../STYLE_GUIDE.md)):

```ts
const lxm = app.bsky.actor.getPreferences.$lxm // 'app.bsky.actor.getPreferences'
const aud = computeProxyTo(ctx, req, lxm)
permissions.assertRpc({ aud, lxm })
```

| Accessor        | Use                                                                  |
| --------------- | -------------------------------------------------------------------- |
| `$lxm`          | lexicon method id, for auth scopes and proxy targets                 |
| `$type`         | record type, e.g. `uri.collection === app.bsky.feed.post.$type`      |
| `$token`        | a token def's string value (`app.bsky.graph.defs.curatelist.$token`) |
| `$build({...})` | construct a value with its `$type` set                               |

`$build` is how union members are constructed:

```ts
app.bsky.graph.defs.notFoundActor.$build({ actor, notFound: true })
```

For shapes that carry no `$type`, just annotate or `satisfies` the exported type
(`com.atproto.server.defs.InviteCode`).

## Type-only references

```ts
type Params = app.bsky.feed.getAuthorFeed.$Params
type Output = app.bsky.feed.getAuthorFeed.$Output // { encoding, body }
type Body = app.bsky.feed.getAuthorFeed.$OutputBody // just the body
type PostRecord = app.bsky.feed.post.Main
type PostView = app.bsky.feed.defs.PostView
```

`$OutputBody` is the one you want for helper functions that compute a response
body; `$Output` includes the `encoding` wrapper. Inputs mirror this with
`$Input` / `$InputBody`, and subscriptions use `$Message`.

## Subscriptions

Register a subscription schema with an async generator. Yield `$build()`-ed
messages; the server frames and (unless `validateResponse: false`) validates
each one. `signal` aborts when the client disconnects — thread it into whatever
produces events so the generator unwinds.

```ts
server.add(
  com.atproto.sync.subscribeRepos,
  async function* ({
    params,
    signal,
  }): AsyncGenerator<com.atproto.sync.subscribeRepos.$Message> {
    const { cursor } = params
    const curr = await ctx.sequencer.curr()
    if (cursor !== undefined && cursor > (curr ?? 0)) {
      throw new InvalidRequestError('Cursor in the future.', 'FutureCursor')
    }
    for await (const evt of outbox.events(cursor, signal)) {
      yield com.atproto.sync.subscribeRepos.commit.$build({
        seq: evt.seq,
        time: evt.time,
        ...evt.evt,
      })
    }
  },
)
```

Annotating the generator's return type keeps errors on the offending `yield`
rather than on the whole `server.add()` call. Throwing before the first yield
rejects the connection with that error. The subscription context is
`{ params, auth, req, signal }` — and `req` here is a raw Node
`IncomingMessage`, not an Express `Request`.

`packages/pds/src/api/com/atproto/sync/subscribeRepos.ts` is the only
subscription in the repo and the reference implementation.

## File layout

Handlers live under `src/api/<nsid-path>.ts`, one file per method, filename
matching the method name in camelCase (the documented exception to the
kebab-case rule), each default-exporting a registrar:

```
packages/bsky/src/api/
  app/bsky/feed/getAuthorFeed.ts   ← export default function (server, ctx) { server.add(...) }
  com/atproto/identity/resolveHandle.ts
  index.ts                         ← imports each module and calls it
```

`src/api/index.ts` is a flat list of imports followed by a flat list of
`handler(server, ctx)` calls; add new routes in both places.

## Related skills

- **[lex-schema](../lex-schema/SKILL.md)** — the generated schemas passed to
  `server.add()`, and their `$`-accessors. Needed alongside this skill for
  almost any route work.
- **[lex-data](../lex-data/SKILL.md)** — branded strings, `BlobRef`, CBOR, and
  datetimes at route boundaries.
- **[lex-client](../lex-client/SKILL.md)** — when the service also calls _out_
  to other services.
- **[lexification-server](../lexification-server/SKILL.md)** — migrating an
  existing service off the legacy `lex gen-server` stack onto the patterns
  above.
- **[lex-setup](../lex-setup/SKILL.md)** — lexicon install/build configuration.
- **[testing](../testing/SKILL.md)** — runner choice and test placement when
  testing route handlers.
