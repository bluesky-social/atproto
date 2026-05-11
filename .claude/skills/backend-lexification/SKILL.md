---
name: backend-lexification
description: >
  Migrate backend apis from `@atproto/api`, `@atproto/lexicon`, `@atproto/xrpc`,
  and `@atproto/lex-cli` to `@atproto/lex`. Use this skill whenever the user
  wants to adopt `@atproto/lex` in a package that currently relies on
  `@atproto/lex-cli` to perform code generation, replace AtpAgent with Client,
  migrate generated lexicon code to the new `lex build` output, replace
  `ids.XxxYyy` with namespace accessors, adopt branded string types, switch from
  `jsonStringToLex` to `lexParse`, or any refactoring that moves code from the
  old generated lexicon system to `@atproto/lex`. Also trigger when the user
  mentions "lexification", "lex SDK", "lex migration", or asks about replacing
  `@atproto/api` imports in service code.
---

# Lexification: Migrating to `@atproto/lex`

This skill describes how to refactor an AT Protocol service package to replace:

- `@atproto/api` (the old high-level client)
- `@atproto/lexicon` (the old runtime lexicon library)
- `@atproto/xrpc` (the old XRPC client types)
- `@atproto/lex-cli` codegen (the old code generator that produced `src/lexicon/` directories)

...with `@atproto/lex`, which provides generated TypeScript schemas with type-safe validation, type guards, builders, and an XRPC client.

For the full `@atproto/lex` API reference, read `packages/lex/lex/README.md`.

## Guiding Principles

- **Minimize runtime changes.** Prefer type-level changes over runtime changes. If the old code works correctly at runtime, keep its logic and just improve the types around it.
- **Tests still use `@atproto/api` exclusively.** Do not migrate test files — they will be migrated in a separate phase. Tests that imported from the old `src/lexicon/` should switch to importing from `@atproto/api` instead.

## What `@atproto/lex` Provides

- **Generated TypeScript schemas** via `lex build` (replaces `lex-cli`'s `lex gen-server`)
- **Runtime utilities**: `lexParse`, `lexStringify`, `toDatetimeString`, `currentDatetimeString`
- **Branded string types**: `DidString`, `HandleString`, `AtIdentifierString`, `AtUriString`, `UriString`, `DatetimeString`
- **Type guards**: `isDidString`, `isHandleString`, `isAtIdentifierString`, `isAtUriString`
- **Data types**: `Cid`, `parseCid`, `BlobRef` (from `@atproto/lex-data` sub-export, also re-exported from `@atproto/lex`)
- **`Client` class**: replaces `AtpAgent` for service-to-service XRPC calls
- **`xrpc` / `xrpcSafe` functions**: standalone XRPC requests with structured error handling
- **`XrpcError`**: replaces `XRPCError` from `@atproto/xrpc`
- **Type-safe schema accessors**: `$type`, `$matches`, `$isTypeOf`, `$build`, `$safeParse`, `$lxm`, etc.

The generated schemas live in `src/lexicons/` (note the plural). They expose a namespace-based API (e.g., `app.bsky.feed.post`) with `$type`, `$build`, `$check`, `$matches`, `$isTypeOf`, `$parse`, `$validate`, `$safeParse`, `$lxm`, and other utilities.

## Overview of Changes

The refactor touches these areas (in recommended order):

1. **Project Configuration** - Update `package.json` dependencies, build scripts and git configuration
2. **Project Code Setup** - Replace server creation, endpoint registration, imports from old generated code, app context initialization (`AtpAgent` → `Client`), and type aliases with new patterns from `@atproto/lex`
3. **Endpoint Handlers Registration** - New `server.add()` pattern, handler return types, LXM references, and parameter/output/record type replacements
4. **XRPC Client Calls** - Replace `AtpAgent` API calls with `Client.xrpc()`, `Client.call()`, or `xrpcSafe()`
5. **Type Strictness** - Use branded types (`DidString`, `HandleString`, `AtUriString`, `Cid`, etc.)
6. **Data Utilities** - Replace old data manipulation functions (`jsonStringToLex` → `lexParse`, datetime helpers, `BlobRef`, etc.)
7. **Schema Validation and Type Guards** - Replace old `isX()` functions with `$matches()` / `$isTypeOf` / `$build()`

## 1. Project Configuration

### Dependencies

Add `@atproto/lex` as a dependency.

Remove from dependencies (if present):

- `multiformats` (CID handling is now in `@atproto/lex-data`)

Remove from devDependencies:

- `@atproto/api` (unless still needed for tests in this phase)
- `@atproto/lexicon`
- `@atproto/lex-cli`
- `@atproto/xrpc`

### Lexicon installation

Remove the old `src/lexicon/` directory (singular) and any codegen scripts that referenced `lex gen-server`. We will also remove the (manually maintained) `./lexicons/` directory in order to manage installed lexicons with the new `lex install` commands:

```sh
rm -rf ./src/lexicon
rm -rf ./lexicons
```

Install every lexicon NSID that the code uses. Run `lex install` once per NSID (or pass multiple NSIDs at once):

```sh
lex install com.atproto.identity.resolveHandle app.bsky.feed.post
```

> [!NOTE]
> Some systems (like MacOS) already have a `lex` command. If that is the case, use `npx lex`, `pnpm exec lex` or `yarn lex` to run the correct binary.

This creates a `manifest.json` and a local `./lexicons/` directory with the schema files the package depends on.

The `manifest.json` file and `./lexicons/` directory (schema inputs) should be committed to git.

### Code generation

Replace the old codegen script with `lex build` as a prebuild step:

```diff
- "codegen": "lex gen-server --yes ./src/lexicon ./lexicons/com/atproto/*/* ./lexicons/app/bsky/*/* ...",
+ "prebuild": "lex build --lexicons ./lexicons --clear --indexFile",
+ "postinstall": "lex install --ci",
```

The `--indexFile` flag generates an index file that re-exports all root-level namespaces, and `--clear` ensures a clean output directory on each build.

The `lex install --ci` command will ensure that the `manifest.json` is up to date with the installed lexicons. Using the `postinstall` hook ensures that the command runs after `npm install` or `yarn install`, which ensures lexicon integrity in CI environments.

The `./src/lexicons/` directory (generated output) should be gitignored since it is regenerated on every build:

```sh
echo '/src/lexicons/' >> .gitignore
```

## 2. Project Code Setup

After running `lex build`, the new generated code lives in `src/lexicons/` (plural). Import the namespace objects from the index file:

```typescript
import { app, com, chat } from '../lexicons/index.js'
```

Each namespace provides access to schemas through dot notation:

- `app.bsky.feed.post` - a record schema
- `app.bsky.feed.defs.postView` - an object definition
- `com.atproto.admin.defs.repoRef` - another object definition
- `app.bsky.feed.getAuthorFeed` - a query/procedure schema

The old codegen used `ids` for NSID string constants (e.g., `ids.AppBskyFeedPost`). These are replaced with `$type` or `$lxm` properties on the schema objects.

> [!NOTE]
>
> If the app's build process & bundler supports it, consider using path aliases to simplify imports from `src/lexicons/index.js` (e.g., `import { app } from '#lexicons'`).

### Server Creation

The `createServer` function now comes from `@atproto/xrpc-server` directly, not from generated code:

```diff
- import { createServer } from './lexicon'
+ import { createServer } from '@atproto/xrpc-server'
```

The call signature changes slightly:

```diff
- let server = createServer({
+ const server = createServer([], {
    validateResponse: config.debugMode,
    payload: { ... },
  })
```

Note the empty array `[]` as first argument.

The `Server` type used in handler files also changes:

```diff
- import { Server } from '../../../../lexicon'
+ import { Server } from '@atproto/xrpc-server'
```

The server's express router is accessed differently:

```diff
- app.use(server.xrpc.router)
+ app.use(server.router)
```

### App Context / Initialization

Replace `AtpAgent` with `Client` from `@atproto/lex`:

```diff
- import { AtpAgent } from '@atproto/api'
+ import { Client } from '@atproto/lex'
```

In context/config files, rename fields:

```diff
- searchAgent: AtpAgent | undefined
+ searchClient: Client | undefined
```

Client instantiation:

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

Headers are passed directly in the `Client` constructor options rather than being set imperatively after construction.

### Type Aliases File (if applicable)

The recommended pattern is to import from the generated code directly where needed, using import aliases. However, if the project contains a centralized types file that re-exports types from generated schemas, update it to import from the new generated code.

```typescript
import { app, chat, com } from '../lexicons/index.js'

// Type aliases
export type PostRecord = app.bsky.feed.post.Main
export type PostView = app.bsky.feed.defs.PostView
export type Label = com.atproto.label.defs.Label
export type StrongRef = com.atproto.repo.strongRef.Main

// Type guard aliases
export const isPostRecord = app.bsky.feed.post.$matches
export const isImagesEmbed = app.bsky.embed.images.$matches

// Validation aliases
export const parseStrongRef = com.atproto.repo.strongRef.$safeParse
```

The pattern is consistent:

- **Type**: `export type Foo = namespace.path.TypeName`
- **Type guard**: `export const isFoo = namespace.path.$matches`
- **Validation**: `export const parseFoo = namespace.path.$safeParse`

Types for the "main" definition of a record/object use `.Main`, sub-definitions use their specific name (e.g., `.ReplyRef`, `.ViewRecord`).

## 3. Endpoint Handlers Registration

The old pattern used method-chain registration on the server object. The new pattern uses `server.add()` with the schema object:

```diff
- server.app.bsky.feed.getAuthorFeed({
+ server.add(app.bsky.feed.getAuthorFeed, {
    auth: ctx.authVerifier.optionalStandardOrRole,
    handler: async ({ params, auth, req }) => { ... },
  })
```

```diff
- server.com.atproto.identity.resolveHandle(async ({ req, params }) => {
+ server.add(com.atproto.identity.resolveHandle, async ({ params }) => {
```

The schema object is always imported from the generated `lexicons/` directory.

### Handler Return Type Safety

When handlers return JSON responses, use `'application/json' as const` for the encoding field to satisfy the return type:

```typescript
return {
  encoding: 'application/json' as const,
  body: { preferences },
}
```

Without the `as const`, TypeScript widens the string literal type and the handler's return type won't match. This is a type-level change only.

Alternatively, a `satisfies` clause can be used to ensure the returned object matches the expected schema output type:

```typescript
return {
  encoding: 'application/json',
  body: { preferences },
} satisfies app.bsky.actor.getPreferences.$Output
```

### LXM References in Handlers

Inside handlers, access the `$lxm` property from the schema for auth/proxy computations:

```typescript
const lxm = app.bsky.actor.getPreferences.$lxm
const aud = computeProxyTo(ctx, req, lxm)
permissions.assertRpc({ aud, lxm })
```

### Query/Procedure Parameter Types

Replace old codegen type imports with `$Params` on the schema:

```diff
- import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
+ import { app } from '../../../../lexicons/index.js'

- type Params = QueryParams
+ type Params = app.bsky.feed.getAuthorFeed.$Params
```

### Output Types

Use `$Output` for response type annotations with `satisfies`:

```typescript
return {
  encoding: 'application/json' as const,
  body: { actor, relationships },
} satisfies app.bsky.graph.getRelationships.$Output
```

### Record/Object Types

Replace individual type imports with namespace-based access:

```diff
- import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
+ // Use the types file or direct namespace access:
+ import { PostRecord } from './types.js'
+ // or: app.bsky.feed.post.Main
```

### Type Aliases for Defs

When code uses types from `defs` files, reference them through the namespace:

```diff
- import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'
+ // Use namespace access:
+ type StatusAttr = com.atproto.admin.defs.StatusAttr
```

```diff
- type CodeDetail = SomeCustomType
+ type CodeDetail = com.atproto.server.defs.InviteCode
+ type CodeUse = com.atproto.server.defs.InviteCodeUse
```

Whenever a new object with a `$type` needs to be constructed, use the `$build()` method on the schema:

```typescript
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

Otherwise, for plain data objects that don't require a `$type`, just use the namespace types for type annotations without changing the construction logic:

```typescript
const code: com.atproto.server.defs.InviteCode = {
  code: invite.code,
  available: invite.availableUses - invite.uses.length,
  disabled: invite.disabled === 1,
  forAccount: invite.forUser,
  createdBy: invite.createdBy,
  createdAt: invite.createdAt,
  uses: invite.uses,
}
```

### Token Values

For accessing lexicon "token" string constants:

```diff
- import { CURATELIST, MODLIST } from '../../../../lexicon/types/app/bsky/graph/defs'
+ import { app } from '../../../../lexicons/index.js'
+ const CURATELIST = app.bsky.graph.defs.curatelist.value
+ const MODLIST = app.bsky.graph.defs.modlist.value
```

### NSID String Constants

The old `ids` object (e.g., `ids.AppBskyFeedPost`) is replaced by `$type` on the schema:

```diff
- import { ids } from '../../../lexicon/lexicons'
- if (uri.collection === ids.AppBskyGraphList) {
+ import { app } from '../../../lexicons/index.js'
+ if (uri.collection === app.bsky.graph.list.$type) {
```

For LXM (lexicon method) checks in auth:

```diff
- method === ids.AppBskyFeedGetFeedSkeleton
+ method === app.bsky.feed.getFeedSkeleton.$lxm
```

For simple comparisons in utility code, plain string literals are also acceptable:

```diff
- if (uri.collection === ids.AppBskyFeedPost) {
+ if (uri.collection === 'app.bsky.feed.post') {
```

## 4. XRPC Client Calls

### Using `Client.xrpc()`

Replace `AtpAgent` API calls with `Client.xrpc()`:

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

- Response data is on `.body` (not `.data`)
- Response headers use the standard `Headers` API (`.get()`)
- Parameters go in a `params` sub-object
- Procedure input goes in an `input` sub-object (not used in this example)

### Using `Client.call()`

Calls that only need the response body, and are happy letting any error propagate, can use the simpler `call()` method:

```typescript
const body = await ctx.suggestionsClient.call(
  app.bsky.unspecced.getSuggestionsSkeleton,
  // "params" for Queries, "input" for Procedures:
  { viewer: params.hydrateCtx.viewer, relativeToDid },
  // Optional additional options (see API reference):
  {
    headers,
    signal,
  },
)
```

### Using `xrpcSafe()` for Error Handling

For calls where you want to handle errors without exceptions, use `xrpcSafe()`:

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
+ // result.body is the typed response
```

### XrpcError

Replace `XRPCError` from `@atproto/xrpc` with `XrpcError` from `@atproto/lex`:

```diff
- import { XRPCError } from '@atproto/xrpc'
+ import { XrpcError } from '@atproto/lex'
```

## 5. Type Strictness (Branded Types)

`@atproto/lex` exports branded string types that improve type safety. Apply these at type boundaries — function signatures, interface fields, database schema types — while keeping runtime code unchanged where possible.

### `DidString`

```diff
- did: string
+ did: DidString
```

```diff
- iss: string
+ iss: DidString | `${DidString}#${string}`
```

Use the type guard instead of string prefix checks:

```diff
- if (typeof iss !== 'string' || !iss.startsWith('did:')) {
+ if (typeof iss !== 'string' || !isDidString(iss)) {
```

Import from `@atproto/lex`:

```typescript
import { DidString, isDidString } from '@atproto/lex'
```

### `HandleString`

```diff
- handle: string
+ handle: HandleString
```

```typescript
import { HandleString, isHandleString } from '@atproto/lex'
```

### `AtIdentifierString`

For parameters that accept either a DID or a handle:

```diff
- handleOrDid: string
+ handleOrDid: AtIdentifierString
```

Use the guard before passing to functions that require a specific type:

```typescript
import { AtIdentifierString, isAtIdentifierString } from '@atproto/lex'

if (!isAtIdentifierString(actor)) {
  throw new InvalidRequestError('Invalid actor identifier')
}
const account = await getAccount(actor)
```

### `AtUriString`

Apply to URI fields coming from data plane responses:

```diff
- post: { uri: item.uri, cid: item.cid || undefined },
+ post: { uri: item.uri as AtUriString, cid: item.cid || undefined },
```

### `Cid`

Replace `CID` from `multiformats` with `Cid` from `@atproto/lex-data`:

```diff
- import { CID } from 'multiformats/cid'
+ import { Cid, parseCid } from '@atproto/lex-data'
```

Or import from `@atproto/lex` directly:

```typescript
import { Cid } from '@atproto/lex'
```

### `DatetimeString`

For datetime fields in database schemas and interfaces:

```diff
- indexedAt: string
+ indexedAt: DatetimeString
```

### Type Narrowing at Data Boundaries

When data comes from external sources (protobuf, data plane, Kysely queries), cast to branded types at the boundary:

```diff
- suggestedDids: dids,
+ suggestedDids: dids as DidString[],
```

```diff
- qb.where('actor.did', '=', filter.sub!)
+ qb.where('actor.did', '=', filter.sub! as DidString)
```

This pattern is common when Kysely query builders need branded types that the query parameter doesn't naturally have.

### `HeadersMap`

Replace `Record<string, string>` headers with proper `Headers` type:

```diff
- import { HeadersMap } from '@atproto/xrpc'
+ import { Headers as HeadersMap } from '@atproto/xrpc-server'
```

> [!NOTE]
>
> `Headers` from `@atproto/xrpc-server` conflicts with the standard `Headers` type, so we alias it as `HeadersMap` to avoid confusion.

Response headers from `xrpc()` calls use the standard `Headers` API:

```diff
- result.headers['content-language']
+ result.headers.get('content-language')
```

## 6. Data Utilities

### JSON/Lex Parsing

Replace `jsonStringToLex` from `@atproto/lexicon` with `lexParse` from `@atproto/lex`:

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

`lexParse` accepts a type parameter, eliminating the need for `as` casts.

### Datetime Strings

Replace `new Date().toISOString()` with branded datetime utilities for AT Protocol datetime fields:

```diff
- createdAt: new Date().toISOString(),
+ createdAt: currentDatetimeString(),
```

For converting an existing `Date` object:

```diff
- indexedAt: someDate.toISOString(),
+ indexedAt: toDatetimeString(someDate),
```

```typescript
import { toDatetimeString, currentDatetimeString } from '@atproto/lex'
```

### BlobRef

The old `BlobRef` class from `@atproto/lexicon` is replaced by a simple interface from `@atproto/lex-data`. It is no longer a class, so `instanceof` checks are not possible anymore. Instead, use type guards to check if an object is a `BlobRef`:

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

### Legacy BlobRefs

Legacy blob references (`{ cid: string, mimeType: string }`) are automatically handled based on the **strict mode** setting. When `strict: false`, both standard and legacy blob formats are accepted. When `strict: true` (the default), only standard `TypedBlobRef` format is accepted.

```typescript
import {
  TypedBlobRef,
  LegacyBlobRef,
  isTypedBlobRef,
  isLegacyBlobRef,
} from '@atproto/lex-data'

// Check for standard BlobRef
if (isTypedBlobRef(value)) {
  console.log(value.ref.toString())
}

// Check for legacy format
if (isLegacyBlobRef(value)) {
  console.log(value.cid)
}
```

New utility functions are available for working with both formats:

```typescript
import {
  BlobRef,
  getBlobCid,
  getBlobCidString,
  getBlobMime,
  getBlobSize,
} from '@atproto/lex-data'

declare const blobRef: BlobRef // TypedBlobRef | LegacyBlobRef

const cid = getBlobCid(blobRef) // Returns Cid object
const cidString = getBlobCidString(blobRef) // Returns string (optimized)
const mimeType = getBlobMime(blobRef)
const size = getBlobSize(blobRef) // Returns number | undefined (legacy refs don't have size)
```

### Strict Mode in Validation

All schema validation methods (`$parse`, `$safeParse`, `$validate`, `$safeValidate`) accept an optional `{ strict }` option that controls validation behavior uniformly across both parse and validate modes:

**Strict mode (`strict: true`, the default):**

- Datetime strings must have proper timezone information
- Blob MIME types and size constraints are enforced
- Only raw CIDs are allowed in blob references
- Legacy blob references are rejected

**Non-strict mode (`strict: false`):**

- Datetime strings without timezones are accepted
- Blob MIME type and size constraints are not enforced
- Any valid CID is allowed in blob references
- Legacy blob references are accepted

```typescript
// Default strict validation
const result1 = schema.$safeParse(data) // strict: true by default

// Explicit strict validation
const result2 = schema.$safeParse(data, { strict: true })

// Non-strict validation (lenient)
const result3 = schema.$safeParse(data, { strict: false })

// Applies to all validation methods
schema.$validate(data, { strict: false })
schema.$parse(data, { strict: false })
schema.$safeValidate(data, { strict: false })
```

The `Client` class has a `strictResponseProcessing` option that controls the default strict mode for all XRPC calls:

```typescript
const client = new Client(session, {
  strictResponseProcessing: false, // Use non-strict mode for all calls
})
```

When `strictResponseProcessing: false`, response validation will use `strict: false`, which means legacy blobs and other lenient data formats are automatically accepted. Individual calls can override this with per-call options.

### Lex Stringify

```diff
- import { stringifyLex } from '@atproto/lexicon'
+ import { lexStringify } from '@atproto/lex'
```

## 7. Schema Validation and Type Guards

### `$matches()` — Validates and Narrows Unknown Data

Use `$matches()` when the data has not been pre-validated (e.g., it comes from an external source, or you need full runtime validation):

```diff
- import { isRepoRef } from '../../../../lexicon/types/com/atproto/admin/defs'
- if (isRepoRef(subject)) { ... }
+ if (com.atproto.admin.defs.repoRef.$matches(subject)) { ... }
```

```diff
- repost: isSkeletonReasonRepost(item.reason) ? ... : undefined,
+ repost: app.bsky.feed.defs.skeletonReasonRepost.$matches(item.reason) ? ... : undefined,
```

### `$isTypeOf` — Discriminates Pre-Validated Data by `$type`

Use `$isTypeOf` when the data is already validated and you only need to discriminate based on the `$type` property. This is faster than `$matches()` because it skips validation. Common in `.find()` and `.filter()` callbacks on arrays of already-parsed preference objects or union members:

```diff
- const personalDetailsPref = prefs.find(
-   (pref) => pref.$type === 'app.bsky.actor.defs#personalDetailsPref'
- )
+ const personalDetailsPref = prefs.find(
+   app.bsky.actor.defs.personalDetailsPref.$isTypeOf,
+ )
```

`$isTypeOf` is a type predicate function, so TypeScript narrows the type automatically when used in conditionals or `.find()`.

### `$build()` — Constructs Typed Objects

Use `$build()` instead of manually setting `$type`:

```diff
- return {
-   $type: 'app.bsky.graph.defs#relationship',
-   did,
-   following: subject.following,
- }
+ return app.bsky.graph.defs.relationship.$build({
+   did,
+   following: subject.following,
+ })
```

```diff
- prefs.push({
-   $type: 'app.bsky.actor.defs#declaredAgePref',
-   isOverAge13: age >= 13,
-   isOverAge16: age >= 16,
-   isOverAge18: age >= 18,
- })
+ prefs.push(
+   app.bsky.actor.defs.declaredAgePref.$build({
+     isOverAge13: age >= 13,
+     isOverAge16: age >= 16,
+     isOverAge18: age >= 18,
+   }),
+ )
```

`$build()` automatically sets the `$type` field and returns a properly typed object.

## Tests

Tests still rely exclusively on `@atproto/api`. When tests previously imported from the old `src/lexicon/` directory, redirect those imports to `@atproto/api`:

```diff
- import { ids } from '../../src/lexicon/lexicons'
- import { RepoRef, isRepoRef } from '../../src/lexicon/types/com/atproto/admin/defs'
- import { $Typed } from '../../src/lexicon/util'
+ import { $Typed, AtpAgent, ComAtprotoAdminDefs, ids } from '@atproto/api'
```

Do not change how tests make XRPC calls — they continue to use `AtpAgent` from `@atproto/api`. This allows to ensure that the refactor does not break existing functionality at runtime. Tests will be migrated to `@atproto/lex` in a separate phase after all service code has been lexified.

## Common Pitfalls

1. **`$type` vs `$lxm`**: Use `$type` for record/object type strings (e.g., `app.bsky.feed.post.$type` = `'app.bsky.feed.post'`). Use `$lxm` for XRPC method identifiers used in auth checks and proxy routing. `$nsid` is also available for the raw NSID string if needed, this is especially useful for lexicon defs that don't have a `main` type but still need to reference their NSID.

2. **`$matches` vs `$isTypeOf`**: Use `$matches()` when data needs validation (unknown input). Use `$isTypeOf` when data is already validated and you just need to check the `$type` tag (e.g., union discrimination, filtering an array of pre-parsed objects).

3. **Branded type casts at boundaries**: Data from protobuf/data plane/Kysely returns plain strings. Cast to branded types (`as DidString`, `as AtUriString`) at the point where data enters the typed domain. Avoid `assert()` — use `as` casts at known-safe boundaries instead.

4. **`'application/json' as const`**: Handler return values need `as const` on the encoding string literal to satisfy the return type. Without it, TypeScript widens the type.

5. **Response header changes**: Old `AtpAgent` returned headers as a plain object with string indexing. New `Client`/`xrpc` returns standard `Headers` objects requiring `.get()`.

6. **`@atproto/lex-data` sub-export**: `Cid`, `parseCid`, and `BlobRef` are available from `@atproto/lex-data` for files that only need data types without the full `@atproto/lex` package. Both import paths work.

7. **Prefer `@atproto/lex` imports** over `@atproto/syntax` when both export the same symbol (e.g., `DidString`, `AtUriString`).

8. **Avoid `assert()` calls.** Use type guards (`isDidString()`, `isHandleString()`) with conditional logic rather than assertions.

## Import Source Changes Summary

| Before                                            | After                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@atproto/api` (`AtpAgent`)                       | `@atproto/lex` (`Client`)                                                    |
| `@atproto/lexicon` (`jsonStringToLex`, `BlobRef`) | `@atproto/lex` (`lexParse`, `BlobRef`)                                       |
| `@atproto/lexicon` (`stringifyLex`)               | `@atproto/lex` (`lexStringify`)                                              |
| `@atproto/xrpc` (`HeadersMap`, `XRPCError`)       | `@atproto/xrpc-server` (`Headers`), `@atproto/lex` (`XrpcError`, `xrpcSafe`) |
| `multiformats/cid` (`CID`)                        | `@atproto/lex` (`Cid`, `parseCid`)                                           |
| `@atproto/syntax` (`DidString`, etc.)             | `@atproto/lex` (`DidString`, `HandleString`, etc.) — prefer `@atproto/lex`   |
| `../lexicon` (`Server`, `createServer`)           | `@atproto/xrpc-server` (`Server`, `createServer`)                            |
| `../lexicon/lexicons` (`ids`)                     | `../lexicons/index.js` (`app`, `com`, `chat`)                                |
| `../lexicon/types/...` (types, guards)            | `../lexicons/index.js` (namespace-qualified access)                          |
