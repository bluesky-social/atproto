---
name: xrpc-server
description: >
  Use whenever code defines the **server side** of an AT Protocol XRPC service
  with `@atproto/xrpc-server`. Trigger on ANY of: (1) `createServer`,
  `server.add(schema, handler)`, `server.router`, or the `Server` type;
  (2) writing/editing an XRPC route handler — `{ params, input, auth, req, res,
  signal }` args, `{ encoding, body }` returns, `'application/json' as const`,
  `satisfies $Output`; (3) throwing server-side errors (`XRPCError` — capital R,
  `InvalidRequestError`, `AuthRequiredError`, `ForbiddenError`,
  `UpstreamFailureError`); (4) its `Headers` / `HeadersMap`; (5) WebSocket
  subscription endpoints; (6) handler layout under `src/api/<namespace>/`.
  Client-side calls → `lex-client`; schemas → `lex-schemas`;
  codegen → `lex-setup`; migrating off `lex gen-server` → `lexification-server`.
disable-model-invocation: false
---

# `@atproto/xrpc-server`

`@atproto/xrpc-server` is the server half of the AT Protocol XRPC stack. It
exposes `createServer` and the `Server` type; service code registers endpoints
by passing generated lexicon schemas to `server.add()`.

It is **not re-exported** by `@atproto/lex` — always import it directly:

```ts
import { createServer, Server, InvalidRequestError } from '@atproto/xrpc-server'
```

## What this package provides

| Export                                                                         | Purpose                                                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `createServer`, `Server`                                                       | Server factory and type; `server.router` for Express                                                                |
| `XRPCError` (capital R)                                                        | Base class for errors **thrown** in handlers                                                                        |
| `InvalidRequestError` (400), `AuthRequiredError` (401), `ForbiddenError` (403) | Typed error responses                                                                                               |
| `UpstreamFailureError`, `UpstreamTimeoutError`                                 | Upstream failure signalling                                                                                         |
| `Headers`                                                                      | `Record<string, string>` header map — usually imported as `HeadersMap` to avoid colliding with the global `Headers` |

Note the casing split: `XRPCError` is server-side (thrown in handlers);
`XrpcError` is the client-side class from `@atproto/lex`.

## Creating the server

```ts
import { createServer } from '@atproto/xrpc-server'

const server = createServer([], {
  validateResponse: config.debugMode,
  payload: {/* ... body limits, etc. ... */},
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
        body: {/* ... */},
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
const view: com.atproto.server.defs.InviteCode = {/* ... */}
```

## Errors

Throw `InvalidRequestError` (or another `XRPCError` subclass) to return
typed XRPC errors. The constructor takes `(message, errorName?)` — the
`errorName` should match a declared error in the lexicon:

```ts
import { InvalidRequestError } from '@atproto/xrpc-server'

throw new InvalidRequestError('Drafts limit reached', 'DraftLimitReached')
```

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

## Related skills

- **[lex-schemas skill](../lex-schemas/SKILL.md)** — the generated schemas
  passed to `server.add()` (`./lexicons/index.js`, `$Params`, `$Output`,
  `$lxm`, `$type`, `$build`). Needed alongside this skill for almost any
  route work.
- **[lexification-server skill](../lexification-server/SKILL.md)** — migrating
  an existing service off the legacy `lex gen-server` stack onto the patterns
  above.
- **[lex-setup skill](../lex-setup/SKILL.md)** — lexicon install/build
  configuration and `@atproto/lex` package layout.
- **[lex-data-model skill](../lex-data-model/SKILL.md)** — branded strings,
  `BlobRef`, CBOR, and datetime handling at route boundaries.
- **[lex-client skill](../lex-client/SKILL.md)** — when the service also calls
  _out_ to other services.
- **[testing skill](../testing/SKILL.md)** — runner choice (vitest vs jest),
  test file location, and tsconfig setup when testing route handlers.
