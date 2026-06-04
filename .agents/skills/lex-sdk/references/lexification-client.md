# Lexification: migrating client / consumer code

This reference covers migrating **calls out** — code that used `AtpAgent`
or the old `@atproto/lexicon` / `@atproto/xrpc` runtime to talk to AT
Proto services. For migrating a service that **defines** routes, see
[lexification-server.md](lexification-server.md). The two are typically
done together in a service package.

## What changes

| Old                                                 | New                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `AtpAgent` from `@atproto/api`                      | `Client` from `@atproto/lex`                                                    |
| `agent.api.<ns>.<method>(params, { headers })`      | `client.xrpc(<schema>, { params, headers })` or `client.call(<schema>, params)` |
| `result.data` (response body)                       | `result.body`                                                                   |
| `result.headers['content-language']` (plain object) | `result.headers.get('content-language')` (Headers API)                          |
| `XRPCError` from `@atproto/xrpc`                    | `XrpcError` from `@atproto/lex`                                                 |
| try/catch + `instanceof XRPCError`                  | `xrpcSafe()` discriminated result                                               |
| `jsonStringToLex`                                   | `lexParse`                                                                      |
| `stringifyLex`                                      | `lexStringify`                                                                  |
| `BlobRef` class from `@atproto/lexicon`             | `BlobRef` interface from `@atproto/lex-data` (or `@atproto/lex`)                |
| `CID` from `multiformats/cid`                       | `Cid` / `parseCid` from `@atproto/lex`                                          |
| `new Date().toISOString()` for AT Proto datetimes   | `currentDatetimeString()` / `toDatetimeString()`                                |

## XRPC call migration

### Pattern 1 — `Client.xrpc()` for full response

```diff
- const res = await ctx.suggestionsAgent.api.app.bsky.unspecced.getSuggestionsSkeleton(
-   { viewer: params.hydrateCtx.viewer, relativeToDid },
-   { headers: params.headers },
- )
- return {
-   suggestedDids: res.data.actors.map((a) => a.did),
-   headers: res.headers,
- }
+ const res = await ctx.suggestionsClient.xrpc(
+   app.bsky.unspecced.getSuggestionsSkeleton,
+   {
+     params: { viewer: params.hydrateCtx.viewer, relativeToDid },
+     headers: params.headers,
+   },
+ )
+ return {
+   suggestedDids: res.body.actors.map((a) => a.did),
+   contentLanguage: res.headers.get('content-language') ?? undefined,
+ }
```

Key differences:

- Body is on `.body` (not `.data`).
- Headers use the `Headers` API (`.get()`), not plain object access.
- Params go in a `params` sub-object.
- Procedure bodies go in an `input` sub-object.

### Pattern 2 — `Client.call()` when you only want the body

`call()` returns the body directly and lets errors propagate:

```ts
const body = await ctx.suggestionsClient.call(
  app.bsky.unspecced.getSuggestionsSkeleton,
  { viewer: params.hydrateCtx.viewer, relativeToDid }, // params for query, input for procedure
  { headers, signal }, // optional
)
```

### Pattern 3 — `xrpcSafe()` for structured error handling

For calls where errors are a normal part of the contract:

```diff
- import { AtpAgent } from '@atproto/api'
- import { ResponseType, XRPCError } from '@atproto/xrpc'
+ import { xrpcSafe } from '@atproto/lex'

- const agent = new AtpAgent({ service: fgEndpoint })
- try {
-   const result = await agent.api.app.bsky.feed.getFeedSkeleton(
-     { feed, limit, cursor },
-     { headers },
-   )
-   skeleton = result.data
- } catch (err) {
-   if (err instanceof AppBskyFeedGetFeedSkeleton.UnknownFeedError) { ... }
-   if (err instanceof XRPCError) {
-     if (err.status === ResponseType.Unknown) { ... }
-     if (err.status === ResponseType.InvalidResponse) { ... }
-   }
-   throw err
- }
+ const result = await xrpcSafe(fgEndpoint, app.bsky.feed.getFeedSkeleton, {
+   headers,
+   params: { feed, limit, cursor },
+ })
+ if (!result.success) {
+   if (result.matchesSchemaErrors()) {
+     throw new InvalidRequestError(result.message, result.error)
+   }
+   if (result.error === 'InternalServerError') { ... }
+   if (result.error === 'UpstreamFailure') { ... }
+   throw result.reason
+ }
+ // result.body is typed
```

See [xrpc.md](xrpc.md) for the full error class hierarchy.

## Agent → Client setup

```diff
- import { AtpAgent } from '@atproto/api'
+ import { Client } from '@atproto/lex'
```

```diff
- searchAgent: AtpAgent | undefined
+ searchClient: Client | undefined
```

Headers move into the constructor instead of being set imperatively:

```diff
- const myServiceAgent = config.serviceUrl
-   ? new AtpAgent({ service: config.serviceUrl })
-   : undefined
- if (myServiceAgent && config.serviceApiKey) {
-   myServiceAgent.api.setHeader('authorization', `Bearer ${config.serviceApiKey}`)
- }
+ const myServiceClient = config.serviceUrl
+   ? new Client({
+       service: config.serviceUrl,
+       headers: config.serviceApiKey
+         ? { authorization: `Bearer ${config.serviceApiKey}` }
+         : undefined,
+     })
+   : undefined
```

See [client.md](client.md) for the full `Client` API (auth, labelers,
service proxy, repo helpers).

## Errors

```diff
- import { XRPCError } from '@atproto/xrpc'
+ import { XrpcError } from '@atproto/lex'
```

(Server-side `@atproto/xrpc-server` still exports its own `XRPCError` for
**throwing** errors inside handlers — that one stays. See
[server.md](server.md).)

For typed error handling, prefer `xrpcSafe()` over try/catch — see
[xrpc.md](xrpc.md).

## Headers map type

When you need the `Record<string, string>` shape (forwarding, building
request headers, etc.):

```diff
- import { HeadersMap } from '@atproto/xrpc'
+ import { Headers as HeadersMap } from '@atproto/xrpc-server'
```

The `Headers` from `@atproto/xrpc-server` collides with the global
`Headers` type — alias to `HeadersMap` to avoid confusion.

For response headers from `xrpc()` / `client.xrpc()` calls, **use the
standard Headers API:**

```diff
- result.headers['content-language']
+ result.headers.get('content-language')
```

## Data utilities

### JSON ↔ Lex

```diff
- import { jsonStringToLex } from '@atproto/lexicon'
+ import { lexParse } from '@atproto/lex'

- const parsed = jsonStringToLex(
-   Buffer.from(payload).toString('utf8'),
- ) as SubjectActivitySubscription
+ const parsed = lexParse<app.bsky.notification.defs.SubjectActivitySubscription>(
+   Buffer.from(payload).toString('utf8'),
+ )
```

`lexParse` accepts a type parameter — no `as` cast needed.

```diff
- import { stringifyLex } from '@atproto/lexicon'
+ import { lexStringify } from '@atproto/lex'
```

See [data-model.md](data-model.md) for the full set of conversion
helpers (`jsonToLex`, `lexToJson`, `parseLexLink`, `parseLexBytes`, …).

### Datetime strings

Replace `new Date().toISOString()` for AT Proto datetime fields:

```diff
- createdAt: new Date().toISOString(),
+ createdAt: currentDatetimeString(),
```

```diff
- indexedAt: someDate.toISOString(),
+ indexedAt: toDatetimeString(someDate),
```

```ts
import { currentDatetimeString, toDatetimeString } from '@atproto/lex'
```

These return `DatetimeString` (branded) and validate format
correctness — see [data-model.md](data-model.md).

### CIDs

```diff
- import { CID } from 'multiformats/cid'
+ import { Cid, parseCid } from '@atproto/lex-data'
```

(or import directly from `@atproto/lex` — both paths work.)

### BlobRef

`BlobRef` is no longer a class — it's an interface. `instanceof` checks
are gone; use type guards.

```diff
- import { BlobRef } from '@atproto/lexicon'
+ import { BlobRef } from '@atproto/lex-data'

- export const cidFromBlobJson = (json: BlobRef) => {
-   if (json instanceof BlobRef) {
-     return json.ref.toString()
-   }
-   if (json['$type'] === 'blob') {
-     return (json['ref']?.['$link'] ?? '') as string
-   }
-   return (json['cid'] ?? '') as string
- }
+ export const cidFromBlobJson = (json: BlobRef): string => {
+   return json.ref.toString()
+ }
```

```diff
- if (value instanceof BlobRef) { ... }
+ if (isBlobRef(value)) { ... }
```

For the full TypedBlobRef / LegacyBlobRef story (and the strict-mode
behavior that controls which gets accepted), see
[data-model.md](data-model.md).

## Branded types at boundaries

Apply branded types (`DidString`, `HandleString`, `AtUriString`,
`DatetimeString`, `Cid`, etc.) at function signatures, interface fields,
and DB schemas. See [data-model.md](data-model.md) for the full list.

```diff
- did: string
+ did: DidString

- handle: string
+ handle: HandleString
```

Replace `startsWith('did:')` checks with type guards:

```diff
- if (typeof iss !== 'string' || !iss.startsWith('did:')) {
+ if (typeof iss !== 'string' || !isDidString(iss)) {
```

For union types like `did:plc:.../#key1`:

```diff
- iss: string
+ iss: DidString | `${DidString}#${string}`
```

Cast at data boundaries (protobuf, data plane, Kysely) rather than
asserting later:

```diff
- suggestedDids: dids,
+ suggestedDids: dids as DidString[],
```

## Use `$matches` / `$isTypeOf` instead of legacy guards

```diff
- import { isRepoRef } from '../../../../lexicon/types/com/atproto/admin/defs'
- if (isRepoRef(subject)) { ... }
+ if (com.atproto.admin.defs.repoRef.$matches(subject)) { ... }
```

Use `$isTypeOf` on already-validated unions for speed:

```diff
- const personalDetailsPref = prefs.find(
-   (pref) => pref.$type === 'app.bsky.actor.defs#personalDetailsPref'
- )
+ const personalDetailsPref = prefs.find(
+   app.bsky.actor.defs.personalDetailsPref.$isTypeOf,
+ )
```

See [schemas.md](schemas.md) for the full schema-accessor cheat sheet.

## Tests in this phase

Tests still use `@atproto/api`. Don't migrate test code — redirect any
test imports from old `src/lexicon/` to `@atproto/api`:

```diff
- import { ids } from '../../src/lexicon/lexicons'
- import { RepoRef, isRepoRef } from '../../src/lexicon/types/com/atproto/admin/defs'
+ import { ComAtprotoAdminDefs, ids } from '@atproto/api'
```

Test XRPC calls keep using `AtpAgent` — they act as a regression check
that the lexified service still behaves the same at runtime.

## Import source changes summary

| Before                                            | After                                            |
| ------------------------------------------------- | ------------------------------------------------ |
| `@atproto/api` (`AtpAgent`)                       | `@atproto/lex` (`Client`)                        |
| `@atproto/lexicon` (`jsonStringToLex`, `BlobRef`) | `@atproto/lex` (`lexParse`, `BlobRef`)           |
| `@atproto/lexicon` (`stringifyLex`)               | `@atproto/lex` (`lexStringify`)                  |
| `@atproto/xrpc` (`XRPCError`)                     | `@atproto/lex` (`XrpcError`, `xrpcSafe`)         |
| `@atproto/xrpc` (`HeadersMap`)                    | `@atproto/xrpc-server` (`Headers as HeadersMap`) |
| `multiformats/cid` (`CID`)                        | `@atproto/lex` (`Cid`, `parseCid`)               |
| `@atproto/syntax` (`DidString`, etc.)             | `@atproto/lex` (prefer this)                     |
