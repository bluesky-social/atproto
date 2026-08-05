---
name: lexification-client
description: >
  Migrate AT Protocol client and consumer code off the legacy `@atproto/api`,
  `@atproto/lexicon`, and `@atproto/xrpc` stack onto `@atproto/lex`. Use
  whenever code that *calls out* to an XRPC service is being modernized —
  replacing an `AtpAgent` with `Client`, `result.data` / `result.headers[…]`
  response handling, `XRPCError` try/catch, `jsonStringToLex` / `stringifyLex`,
  `BlobRef` `instanceof` checks, `CID` from `multiformats`,
  `new Date().toISOString()` on AT Proto datetimes, bare `string` DIDs and
  handles, or legacy `isX()` type guards — including when the request is
  phrased as "clean this up" or "modernize this file" rather than "migrate".
  For code that *defines* routes, use the lexification-server skill.
disable-model-invocation: false
---

# Lexification: migrating client / consumer code

Scope: **calls out**. Anything that used `AtpAgent` or the `@atproto/lexicon` /
`@atproto/xrpc` runtime to talk to an AT Proto service, plus the data types
that flow across that boundary.

Route _definitions_ (`server.add`, handler signatures, codegen removal) are the
[lexification-server skill](../lexification-server/SKILL.md). A service package
almost always needs both: it defines routes **and** calls other services. If
you're mid-migration on a service and reach an `agent.api.…` call, you're in
the right file.

## What changes

| Old                                               | New                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `AtpAgent` from `@atproto/api`                    | `Client` from `@atproto/lex`                                           |
| `agent.api.<ns>.<method>(params, { headers })`    | `client.call(<schema>, params, opts)` or `client.xrpc(<schema>, opts)` |
| `result.data`                                     | `result.body`                                                          |
| `result.headers['content-language']`              | `result.headers.get('content-language')` (standard `Headers`)          |
| `XRPCError` from `@atproto/xrpc`                  | `XrpcError` from `@atproto/lex`                                        |
| try/catch + `instanceof XRPCError`                | `xrpcSafe()` / `client.xrpcSafe()` discriminated result                |
| `HeadersMap` from `@atproto/xrpc`                 | `Headers as HeadersMap` from `@atproto/xrpc-server`                    |
| `jsonStringToLex` / `stringifyLex`                | `lexParse` / `lexStringify`                                            |
| `BlobRef` class from `@atproto/lexicon`           | `BlobRef` interface from `@atproto/lex-data` (or `@atproto/lex`)       |
| `CID` from `multiformats/cid`                     | `Cid` / `parseCid` from `@atproto/lex`                                 |
| `new Date().toISOString()` for AT Proto datetimes | `currentDatetimeString()` / `toDatetimeString()`                       |
| `isX(v)` from `src/lexicon/types/…`               | `<ns>.<def>.$matches(v)` / `.$isTypeOf(v)`                             |

## XRPC calls

Three shapes, in rough order of preference — pick the least machinery that
covers what the call site actually uses.

### `call()` — you only want the body

Errors propagate as exceptions. Params (query) or body (procedure) go in the
second argument; everything else in the third.

```ts
return ctx.suggestionsClient.call(
  app.bsky.unspecced.getSuggestedUsersSkeleton,
  { limit: params.limit, viewer: params.hydrateCtx.viewer ?? undefined },
  { headers: params.headers },
)
```

### `xrpc()` — you need status or headers too

```diff
- const res = await ctx.suggestionsAgent.api.app.bsky.unspecced.getSuggestionsSkeleton(
-   { viewer: params.hydrateCtx.viewer, relativeToDid },
-   { headers: params.headers },
- )
- return {
-   suggestedDids: res.data.actors.map((a) => a.did),
-   resHeaders: res.headers,
- }
+ const res = await ctx.suggestionsClient.xrpc(
+   app.bsky.unspecced.getSuggestionsSkeleton,
+   {
+     params: { viewer: params.hydrateCtx.viewer, relativeToDid },
+     headers: params.headers,
+   },
+ )
+ const contentLang = res.headers.get('content-language')
+ return {
+   suggestedDids: res.body.actors.map((a) => a.did),
+   resHeaders: contentLang ? { 'content-language': contentLang } : undefined,
+ }
```

Everything is one options object: query params under `params`, procedure
bodies under `body` (not `input`), plus `headers`, `signal`, `service`,
`labelers`, `maxRetries`, and the validation flags.

Response headers are a standard `Headers` instance. If the value flows into
something typed `HeadersMap` (`Record<string, string>`), pull the specific
headers out with `.get()` as above; if the consumer takes `Headers`, pass it
through unchanged.

### `xrpcSafe()` — errors are part of the contract

Returns a discriminated result instead of throwing, and the failure is typed
against the method schema. Use it where the call site already had a `catch`
that inspected the error rather than just rethrowing.

Narrow on the concrete failure class when the branches map to different
downstream responses (see `packages/bsky/src/api/app/bsky/feed/getFeed.ts`):

```ts
import {
  XrpcInvalidResponseError,
  XrpcResponseError,
  xrpcSafe,
} from '@atproto/lex'

const result = await xrpcSafe(fgEndpoint, app.bsky.feed.getFeedSkeleton, {
  strictResponseProcessing: false,
  signal: AbortSignal.timeout(10_000),
  headers,
  params: { feed, limit, cursor },
})

if (!result.success) {
  const cause = result.reason

  // Structurally valid XRPC error (4xx/5xx) — pass it through
  if (cause instanceof XrpcResponseError) {
    const { status, body } = cause.toDownstreamError()
    throw new XRPCError(status, body.message, body.error, { cause })
  }

  // Response didn't match the schema
  if (cause instanceof XrpcInvalidResponseError) {
    throw new UpstreamFailureError(
      'feed provided an invalid response',
      'InvalidFeedResponse',
      { cause },
    )
  }

  // Typically a network error
  throw new UpstreamFailureError('feed unavailable', undefined, { cause })
}

const { feed: feedSkele, cursor } = result.body // typed
```

`toDownstreamError()` is what replaces hand-mapping upstream status codes: it
remaps 500 → 502 and strips hop-by-hop headers. It does **not** redact — when
the upstream payload is a structurally valid XRPC error, its `error` / `message`
are passed through verbatim for transparency. Sanitize them yourself before
re-throwing if the upstream may leak internal detail.

When you only care about one schema-declared error code, skip the class checks:

```ts
const res = await xrpcSafe(pds, com.atproto.sync.getLatestCommit, {
  params: { did },
})
if (res.success) return true
if (res.error === 'RepoNotFound') return false
throw res.reason
```

`result.matchesSchemaErrors()` narrows `result.error` to the codes the method
declares, for when you want the compiler to check the code strings.

The old `ResponseType` enum comparisons have no replacement and don't need one:
`XrpcInvalidResponseError` covers `ResponseType.InvalidResponse`, and
`XrpcInternalError` / `XrpcFetchError` cover `ResponseType.Unknown`.

Retries are built in (`maxRetries`, default `0`), so delete any hand-rolled
retry loop wrapped around the call. See [lex-client](../lex-client/SKILL.md)
for the full error hierarchy and client API.

## Agent → Client

```diff
- import { AtpAgent } from '@atproto/api'
+ import { Client } from '@atproto/lex'

- searchAgent: AtpAgent | undefined
+ searchClient: Client | undefined
```

`Client` takes **two** arguments: the agent (a service URL, an `AgentConfig`,
or a session), then per-client options. Static headers belong in the agent
config rather than an imperative `setHeader` after construction — one frozen
config then describes the whole client (see `packages/bsky/src/index.ts`):

```diff
- const myServiceAgent = config.serviceUrl
-   ? new AtpAgent({ service: config.serviceUrl })
-   : undefined
- if (myServiceAgent && config.serviceApiKey) {
-   myServiceAgent.api.setHeader('authorization', `Bearer ${config.serviceApiKey}`)
- }
+ const myServiceClient = config.serviceUrl
+   ? new Client(
+       {
+         service: config.serviceUrl,
+         headers: config.serviceApiKey
+           ? { authorization: `Bearer ${config.serviceApiKey}` }
+           : undefined,
+       },
+       {
+         // Trust internal services to send us well-formed responses
+         strictResponseProcessing: false,
+         validateResponse: config.debugMode,
+       },
+     )
+   : undefined
```

That second argument is worth setting for internal service-to-service clients:
`Client` validates responses by default, which is stricter than `AtpAgent` was,
so a migrated call can start failing on data the old code happily accepted.

## Errors

```diff
- import { XRPCError } from '@atproto/xrpc'
+ import { XrpcError } from '@atproto/lex'
```

`@atproto/xrpc-server` keeps its own `XRPCError` for **throwing** errors out of
handlers — that one is unrelated and stays. A file can legitimately import
both (getFeed.ts above does): `XrpcError` describes a failed call out,
`XRPCError` produces the response going back down.

## Headers map type

```diff
- import { HeadersMap } from '@atproto/xrpc'
+ import type { Headers as HeadersMap } from '@atproto/xrpc-server'
```

Alias it — the unaliased `Headers` shadows the global `Headers` type, which the
same file usually also needs.

## Data utilities

### JSON ↔ Lex

```diff
- import { jsonStringToLex } from '@atproto/lexicon'
+ import { lexParse } from '@atproto/lex'

- const parsed = jsonStringToLex(payload.toString('utf8')) as SubjectActivitySubscription
+ const parsed = lexParse<app.bsky.notification.defs.SubjectActivitySubscription>(
+   payload.toString('utf8'),
+ )
```

`lexParse` takes a type parameter, so the `as` cast goes away. `stringifyLex` →
`lexStringify`. See [lex-data](../lex-data/SKILL.md) for `jsonToLex`,
`lexToJson`, `lexParseJsonBytes`, `parseLexLink`, `parseLexBytes`.

### Datetime strings

```diff
- createdAt: new Date().toISOString(),
+ createdAt: currentDatetimeString(),

- indexedAt: someDate.toISOString(),
+ indexedAt: toDatetimeString(someDate),
```

Both come from `@atproto/lex` and return the branded `DatetimeString`, so a
value that reaches a lexicon field is checked at the type level rather than at
validation time.

### CIDs

```diff
- import { CID } from 'multiformats/cid'
+ import { type Cid, parseCid } from '@atproto/lex'
```

`Cid` is an interface. Drop `multiformats` from the package's dependencies once
no imports remain.

### BlobRef

`BlobRef` is now an interface (a union of `TypedBlobRef` and `LegacyBlobRef`),
so `instanceof` no longer works — and the hand-written fallbacks that used to
paper over the two JSON shapes are exactly what the helpers replace:

```diff
- import { BlobRef } from '@atproto/lexicon'
+ import { type BlobRef, getBlobCidString } from '@atproto/lex-data'

- export const cidFromBlobJson = (json: BlobRef) => {
-   if (json instanceof BlobRef) return json.ref.toString()
-   if (json['$type'] === 'blob') return (json['ref']?.['$link'] ?? '') as string
-   return (json['cid'] ?? '') as string
- }
+ export const cidFromBlobJson = (json: BlobRef): string => getBlobCidString(json)
```

```diff
- if (value instanceof BlobRef) { ... }
+ if (isBlobRef(value)) { ... }
```

`isBlobRef` validates the CID strictly by default; pass `{ strict: false }` for
legacy data. See [lex-data](../lex-data/SKILL.md) for the
`TypedBlobRef` / `LegacyBlobRef` split.

## Branded types at boundaries

Apply `DidString`, `HandleString`, `AtUriString`, `DatetimeString`, `Cid` at
signatures, interface fields, and DB schema types — that's where they stop bad
values propagating. Prefer importing them from `@atproto/lex` over
`@atproto/syntax`.

```diff
- did: string
+ did: DidString

- iss: string
+ iss: DidString | `${DidString}#${string}`
```

Prefix checks become guards:

```diff
- if (typeof iss !== 'string' || !iss.startsWith('did:')) {
+ if (typeof iss !== 'string' || !isDidString(iss)) {
```

Data arriving from protobuf, the data plane, or Kysely is plain `string`. Cast
once at that entry point rather than asserting at every later use:

```diff
- suggestedDids: dids,
+ suggestedDids: dids as DidString[],
```

## Type guards

```diff
- import { isRepoRef } from '../../../../lexicon/types/com/atproto/admin/defs'
- if (isRepoRef(subject)) { ... }
+ if (com.atproto.admin.defs.repoRef.$isTypeOf(subject)) { ... }
```

`$isTypeOf` is the behavioral equivalent of a legacy `isX()` guard, so it is the
default when replacing one — this is what the repo migrated to (see
`packages/pds/src/api/com/atproto/admin/updateSubjectStatus.ts`). It checks only
the `$type` tag, which is all that matters on an already-validated union, and it
doubles as a predicate:

```diff
- const pref = prefs.find((p) => p.$type === 'app.bsky.actor.defs#personalDetailsPref')
+ const pref = prefs.find(app.bsky.actor.defs.personalDetailsPref.$isTypeOf)
```

Reach for `$matches` instead only where the data is genuinely untrusted and a
`$type` tag alone isn't enough of a guarantee — it validates the whole value, so
it costs more. Treat that as a deliberate upgrade at an entry point, not the
default swap for an `isX()` call.

See [lex-schema](../lex-schema/SKILL.md) for the full `$`-accessor cheat sheet.

## Tests

Test migration is partial and lags the source migration. The `pds` and `bsky`
suites mostly still drive `AtpAgent` from `@atproto/api`, and `dev-env` exposes
both `getAgent(): AtpAgent` and `getClient(): Client` for exactly that reason.
`ozone` is entirely un-migrated.

Default to leaving passing tests alone: during a source migration their value
is being an unchanged runtime regression check. Two things force a change:

- **A test imports a legacy path you deleted** (`src/lexicon/…`). Point it at
  the `@atproto/api` equivalent (`ComAtprotoAdminDefs`, `ids`, `$Typed`) — the
  smallest edit that keeps the test running.
- **You are deliberately migrating that test file.** Then it moves wholesale:
  `network.pds.getClient()`, schemas from `src/lexicons/index.js`, `res.body`,
  and helpers like `getBlobCidString` from `@atproto/lex-data`.
  `packages/pds/tests/file-uploads.test.ts` is a migrated example.

Avoid half-migrating a file — a suite mixing `agent.api.…` and `client.call(…)`
for the same operation is harder to read than either end state.

## Import source summary

| Before                                            | After                                            |
| ------------------------------------------------- | ------------------------------------------------ |
| `@atproto/api` (`AtpAgent`)                       | `@atproto/lex` (`Client`)                        |
| `@atproto/lexicon` (`jsonStringToLex`, `BlobRef`) | `@atproto/lex` (`lexParse`, `BlobRef`)           |
| `@atproto/lexicon` (`stringifyLex`)               | `@atproto/lex` (`lexStringify`)                  |
| `@atproto/xrpc` (`XRPCError`)                     | `@atproto/lex` (`XrpcError`, `xrpcSafe`)         |
| `@atproto/xrpc` (`HeadersMap`)                    | `@atproto/xrpc-server` (`Headers as HeadersMap`) |
| `multiformats/cid` (`CID`)                        | `@atproto/lex` (`Cid`, `parseCid`)               |
| `@atproto/syntax` (`DidString`, etc.)             | `@atproto/lex` (prefer this)                     |

Dropped imports usually mean dropped `package.json` dependencies
(`multiformats`, `@atproto/lexicon`, `@atproto/xrpc`), and every package
touched needs a changeset entry.

## Related skills

[lex-client](../lex-client/SKILL.md) for the full `Client` API you're migrating
onto, [lex-setup](../lex-setup/SKILL.md) for codegen and dependency wiring, and
[lexification-server](../lexification-server/SKILL.md) for the route-definition
half — service packages need both.
