# Defining XRPC server routes (`@atproto/xrpc-server`)

The server side of `@atproto/lex` is `@atproto/xrpc-server` — it
exposes the `Server` type and `createServer` factory. Service code
defines XRPC endpoints by passing generated lexicon schemas to
`server.add()`.

This package is **not re-exported** by `@atproto/lex`; import directly:

```ts
import { createServer, Server, InvalidRequestError } from '@atproto/xrpc-server'
```

## Creating the server

```ts
import { createServer } from '@atproto/xrpc-server'

const server = createServer([], {
  validateResponse: config.debugMode,
  payload: {
    /* ... body limits, etc. ... */
  },
})

// Mount on Express
app.use(server.router)
```

The first argument is an array reserved for global middleware (usually
`[]`). The second is the server config (validation, payload limits, …).

Note: `server.router` is the Express handler. Older code accessed
`server.xrpc.router` — that path no longer exists.

## Registering an endpoint with `server.add()`

`server.add(schema, handler)` registers a route. The schema is the
generated lexicon object (`app.bsky.feed.getAuthorFeed`,
`com.atproto.identity.resolveHandle`, …).

### Handler-only form

```ts
import { Server } from '@atproto/xrpc-server'
import { com } from '../../../lexicons/index.js'

export default function (server: Server) {
  server.add(com.atproto.identity.resolveHandle, async ({ params }) => {
    const did = await resolve(params.handle)
    return {
      encoding: 'application/json' as const,
      body: { did },
    }
  })
}
```

### Object form (auth, rate limits, etc.)

```ts
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { app } from '../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.draft.createDraft, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth, req }) => {
      const actorDid = auth.credentials.iss

      if (somethingInvalid) {
        throw new InvalidRequestError('reason', 'ErrorCode')
      }

      return {
        encoding: 'application/json' as const,
        body: {
          /* ... */
        },
      }
    },
  })
}
```

The handler receives `{ params, input, auth, req, res, signal }` (whichever
are relevant for the method type — queries get `params`, procedures get
`input`).

## Handler return type

Handlers must return `{ encoding, body }` for typed responses. **Use
`'application/json' as const`** so TypeScript doesn't widen the literal
to `string`:

```ts
return {
  encoding: 'application/json' as const,
  body: { preferences },
}
```

Alternatively, anchor with `satisfies` against the schema's `$Output`:

```ts
return {
  encoding: 'application/json',
  body: { actor, relationships },
} satisfies app.bsky.graph.getRelationships.$Output
```

Without `as const` or `satisfies`, the inferred return type won't match
the registered schema and you'll get a type error.

## Accessing schema metadata inside handlers

The schema object is in scope inside the handler — use its accessors for
LXM, NSID, parameters, output types, defaults:

```ts
server.add(app.bsky.actor.getPreferences, {
  auth: ctx.authVerifier.optionalStandardOrRole,
  handler: async ({ params, auth, req }) => {
    // LXM for proxy / auth checks
    const lxm = app.bsky.actor.getPreferences.$lxm
    const aud = computeProxyTo(ctx, req, lxm)
    permissions.assertRpc({ aud, lxm })

    // ...
  },
})
```

## Type-only references

Reference parameter and output types via the schema's `$Params` /
`$Output` accessors — no need to import per-method type files:

```ts
type Params = app.bsky.feed.getAuthorFeed.$Params
type Output = app.bsky.feed.getAuthorFeed.$Output

const fn = (p: Params): Output => {
  /* ... */
}
```

Record / object types come from namespace dot-paths:

```ts
type PostRecord = app.bsky.feed.post.Main
type PostView = app.bsky.feed.defs.PostView
type ReplyRef = app.bsky.feed.post.ReplyRef
type Label = com.atproto.label.defs.Label
type StrongRef = com.atproto.repo.strongRef.Main
```

To construct an object whose `$type` must be set, use `$build()`:

```ts
const code = com.atproto.server.defs.inviteCode.$build({
  code: invite.code,
  available: invite.availableUses - invite.uses.length,
  disabled: invite.disabled === 1,
  forAccount: invite.forUser,
  createdBy: invite.createdBy,
  createdAt: invite.createdAt,
  uses: invite.uses,
})
```

For plain (untyped) data shapes, just annotate:

```ts
const view: com.atproto.server.defs.InviteCode = {
  /* ... */
}
```

## Errors

Throw `InvalidRequestError` (or another `XRPCError` subclass) to return
typed XRPC errors. The constructor takes `(message, errorName?)` — the
`errorName` should match a declared error in the lexicon:

```ts
import { InvalidRequestError } from '@atproto/xrpc-server'

throw new InvalidRequestError('Drafts limit reached', 'DraftLimitReached')
```

Other server-side error classes from `@atproto/xrpc-server`:

- `XRPCError` — base class (note: capital R, server-side; the client
  side uses `XrpcError` from `@atproto/lex`)
- `InvalidRequestError` — 400
- `AuthRequiredError` — 401
- `ForbiddenError` — 403
- `UpstreamFailureError`, `UpstreamTimeoutError`, etc.

## Token / NSID checks

To compare a URI's collection to a known NSID:

```ts
if (uri.collection === app.bsky.graph.list.$type) {
  /* ... */
}
```

For LXM checks in auth:

```ts
if (method === app.bsky.feed.getFeedSkeleton.$lxm) {
  /* ... */
}
```

For lexicon "token" defs:

```ts
const CURATELIST = app.bsky.graph.defs.curatelist.value
const MODLIST = app.bsky.graph.defs.modlist.value
```

## Subscriptions

WebSocket subscription endpoints use the same `server.add()` pattern with
the subscription schema. The handler is async-iterator-shaped — see the
relevant subscription schema's `$Frames` / `$Output` for typing.

## File layout convention

In a service package, organize handlers under `src/api/<namespace>/`
mirroring NSID structure, each exporting a `default function (server, ctx)`:

```
packages/bsky/src/api/
  app/bsky/feed/
    getAuthorFeed.ts   ← export default function (server, ctx) { server.add(...) }
    getTimeline.ts
  com/atproto/identity/
    resolveHandle.ts
  index.ts             ← imports each handler module and calls it
```

The top-level `src/api/index.ts` wires everything in:

```ts
import { Server } from '@atproto/xrpc-server'
import getAuthorFeed from './app/bsky/feed/getAuthorFeed.js'
import getTimeline from './app/bsky/feed/getTimeline.js'

export default function (server: Server, ctx: AppContext) {
  getAuthorFeed(server, ctx)
  getTimeline(server, ctx)
  // ...
}
```
