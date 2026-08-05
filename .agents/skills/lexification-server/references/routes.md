# Migrating route files

Read this for step 3: converting `server.<ns>.<method>(…)` registrations to
`server.add(schema, …)`, and moving parameter/output types off
`../lexicon/types/…`.

For the target API in full — auth verifiers, rate limits, pipethrough, error
classes — see the [xrpc-server skill](../../xrpc-server/SKILL.md). This file
covers only what the _migration_ changes.

## Registration

The namespace chain becomes a schema argument. Everything inside the config
object is unchanged:

```diff
- server.app.bsky.feed.getAuthorFeed({
+ server.add(app.bsky.feed.getAuthorFeed, {
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => { /* unchanged */ },
  })
```

The bare-handler form drops the wrapper object:

```diff
- server.com.atproto.identity.resolveHandle(async ({ req, params }) => {
+ server.add(com.atproto.identity.resolveHandle, async ({ params }) => {
```

The schema always comes from the generated tree, imported at the top of the
file alongside `Server`:

```ts
import type { Server } from '@atproto/xrpc-server'
import { com } from '../../../../lexicons/index.js'
```

Migrated code overwhelmingly uses the object form (~187 registrations in
`pds` + `bsky`, versus ~8 bare-handler). Preserve whichever form the file
already had; there is no reason to convert between them during a migration.

## `encoding` and literal widening

`'application/json' as const` is required
**only in the bare-handler form**, where the handler's return type is inferred
before it is checked against the schema, so `encoding` widens to `string` and
the overload fails with `TS2769: No overload matches this call`.

In the object form, `handler` is contextually typed by `LexMethodConfig`, so
the literal is preserved and `as const` is unnecessary:

```ts
// object form — no `as const`
server.add(app.bsky.graph.getRelationships, {
  handler: async ({ params }) => {
    return { encoding: 'application/json', body: { actor, relationships } }
  },
})

// bare-handler form — `as const` required
server.add(com.atproto.identity.resolveHandle, async ({ params }) => {
  return { encoding: 'application/json' as const, body: { did } }
})
```

`satisfies …$Output` on the returned envelope also pins the literal and works
in either form, but it is verbose and the repo does not use it. If a return
needs an explicit contract, the one real precedent annotates the _body_:

```ts
body: { /* … */ } satisfies app.bsky.unspecced.getConfig.$OutputBody,
```

(`$Output` is the whole `{ encoding, body }` envelope; `$OutputBody` is just
the body. Mixing them up produces a confusing excess-property error.)

## Type-only references

```diff
- import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
+ import { app } from '../../../../lexicons/index.js'
- type Params = QueryParams
+ type Params = app.bsky.feed.getAuthorFeed.$Params
```

| Legacy generated type                | Accessor                                    |
| ------------------------------------ | ------------------------------------------- |
| `QueryParams` / `InputSchema` params | `$Params`                                   |
| `OutputSchema`                       | `$OutputBody`                               |
| whole handler output                 | `$Output`                                   |
| `InputSchema` (procedures)           | `$Input`                                    |
| subscription message union           | `$Message`                                  |
| record / main object                 | `.Main`                                     |
| sub-definitions                      | their own name (`.ReplyRef`, `.ViewRecord`) |

Because the namespace object carries both values and types, one
`import { app } from '../lexicons/index.js'` replaces every per-method type
import in the file. Use `import type` when the file needs only types.

## `$lxm` in auth and proxy code

Method-id strings that used to come from `ids`:

```diff
- const aud = computeProxyTo(ctx, req, ids.AppBskyActorGetPreferences)
+ const aud = computeProxyTo(ctx, req, app.bsky.actor.getPreferences.$lxm)
```

Inside a handler where only the schema object is in scope, `l.getMain(ns)`
reaches the underlying method definition (`.output.schema`, `.$type`) — used by
`pds`'s read-after-write helpers and `bsky`'s data-plane record routes.

## Subscriptions

Register the same way; the handler is an async generator and messages are
built with `$build`:

```ts
server.add(
  com.atproto.sync.subscribeRepos,
  async function* ({
    params,
    signal,
  }): AsyncGenerator<com.atproto.sync.subscribeRepos.$Message> {
    yield com.atproto.sync.subscribeRepos.commit.$build({ seq, time, ...evt })
  },
)
```

`signal` is an `AbortSignal` on the subscription context — pass it to whatever
produces events so client disconnects unwind the generator. See
[packages/pds/src/api/com/atproto/sync/subscribeRepos.ts](../../../../packages/pds/src/api/com/atproto/sync/subscribeRepos.ts).

## Errors thrown by handlers

Nothing to do. `InvalidRequestError`, `AuthRequiredError`, `ForbiddenError`,
`InternalServerError`, `UpstreamFailureError`, `UpstreamTimeoutError`,
`NotEnoughResourcesError`, and `MethodNotImplementedError` already come from
`@atproto/xrpc-server` in unmigrated packages — the legacy generated tree never
re-exported them. Leave those imports alone.

What does change is errors the service _catches_ from its own outbound calls —
those move from `@atproto/xrpc`'s `XRPCError` to `XrpcError` from
`@atproto/lex`. `XrpcError` is abstract: catch and narrow it, never construct
it. That half belongs to
[lexification-client](../../lexification-client/SKILL.md).

## Header maps

```diff
- import { HeadersMap } from '@atproto/xrpc'
+ import { Headers as HeadersMap } from '@atproto/xrpc-server'
```

Aliased because `Headers` collides with the DOM global. The types are not
identical: legacy `HeadersMap` was `Record<string, string | undefined>`, the
new `Headers` is `Record<string, string>`. Code that relied on assigning
`undefined` to clear a header needs the key omitted instead.
