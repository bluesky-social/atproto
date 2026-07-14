# Lexification: migrating a service package

This reference describes how to migrate an AT Protocol **service / server**
package from the legacy code-generation stack to `@atproto/lex`.

Replaces:

- `@atproto/api` (high-level client used in services)
- `@atproto/lexicon` (old runtime validation)
- `@atproto/xrpc` (old XRPC client types)
- `@atproto/lex-cli` codegen (`lex gen-server` → `src/lexicon/`)

For migrating consumer / client-only code, see
[lexification-client.md](lexification-client.md) — but note that service
packages typically need both kinds of changes (defining routes **and**
calling other services).

## Guiding principles

- **Minimize runtime changes.** Prefer type-level changes over runtime
  changes. If old code works at runtime, keep its logic and just improve
  the types around it.
- **Tests still use `@atproto/api`.** Do not migrate test files in this
  phase. Tests that imported from old `src/lexicon/` should switch to
  importing from `@atproto/api` instead. Tests will be migrated in a
  separate phase after all service code is lexified.

## Recommended order

1. **Project configuration** — dependencies, build scripts, gitignore.
2. **Project code setup** — `createServer` source, `Server` type imports,
   `AtpAgent` → `Client`, type alias files.
3. **Endpoint registration** — `server.<ns>.<method>(...)` chain →
   `server.add(schema, handler)`.
4. **XRPC client calls** — `agent.api.…` → `client.xrpc()`/`call()` (see
   [lexification-client.md](lexification-client.md)).
5. **Type strictness** — branded types at boundaries.
6. **Data utilities** — `jsonStringToLex` → `lexParse`, datetime helpers,
   `BlobRef` (see [lexification-client.md](lexification-client.md)).
7. **Schema validation / type guards** — `isX()` / `ids.X` →
   `$matches` / `$isTypeOf` / `$build` / `$type` / `$lxm`.

## 1. Project configuration

### Dependencies

Add `@atproto/lex` as a dependency.

Remove from dependencies (if present):

- `multiformats` — CID handling moves to `@atproto/lex-data`.

Remove from devDependencies:

- `@atproto/api` (unless still needed for tests in this phase)
- `@atproto/lexicon`
- `@atproto/lex-cli`
- `@atproto/xrpc`

### Wipe legacy lexicon directories

```sh
rm -rf ./src/lexicon     # generated output (singular)
rm -rf ./lexicons        # manually maintained inputs
```

### Install lexicons + configure build

> [!NOTE]
> This is **not** true if the canonical source for the lexicon json files is the same repo/monorepo. If the lexicon files are maintained in the same repo (for example, in a `lexicons/` directory at the root), you should not run `lex install` or add `lex install --ci` to `postinstall`. Instead, point your build script at the local lexicon files (for example, `lex build --clear --lexicons ../../lexicons` from a package's `src/` directory).

```sh
lex install com.atproto.identity.resolveHandle app.bsky.feed.post  # ...all NSIDs the package uses
```

This creates `manifest.json` (or `lexicons.json`) and `./lexicons/`. Both
get committed.

Update `package.json` scripts:

```diff
- "codegen": "lex gen-server --yes ./src/lexicon ./lexicons/com/atproto/*/* ./lexicons/app/bsky/*/* ...",
+ "prebuild": "lex build --lexicons ./lexicons --clear --indexFile",
+ "postinstall": "lex install --ci",
```

Gitignore the generated output:

```sh
echo '/src/lexicons/' >> .gitignore
```

For full setup details, see [setup.md](setup.md).

## 2. Project code setup

### Server creation

`createServer` now comes from `@atproto/xrpc-server`, not from generated
code. Note the empty array first arg.

```diff
- import { createServer } from './lexicon'
+ import { createServer } from '@atproto/xrpc-server'

- let server = createServer({
+ const server = createServer([], {
    validateResponse: config.debugMode,
    payload: { ... },
  })
```

```diff
- import { Server } from '../../../../lexicon'
+ import { Server } from '@atproto/xrpc-server'
```

```diff
- app.use(server.xrpc.router)
+ app.use(server.router)
```

See [server.md](server.md) for the full server reference.

### App context / agent → client

```diff
- import { AtpAgent } from '@atproto/api'
+ import { Client } from '@atproto/lex'
```

```diff
- searchAgent: AtpAgent | undefined
+ searchClient: Client | undefined
```

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

Headers are passed in the constructor rather than set imperatively
afterward. See [client.md](client.md) for `Client` details.

### Type aliases file (if applicable)

If the package has a centralized `types.ts` re-exporting from old
`src/lexicon/types/...`, point it at the new generated tree:

```ts
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

Pattern:

- **Type**: `export type Foo = namespace.path.TypeName`
- **Type guard**: `export const isFoo = namespace.path.$matches`
- **Validation**: `export const parseFoo = namespace.path.$safeParse`

`.Main` for the main definition; sub-defs use their own name (`.ReplyRef`,
`.ViewRecord`, etc).

## 3. Endpoint handler registration

Old: method-chain registration on the server object.
New: `server.add(schema, handler)`.

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

The schema object is always imported from `./lexicons/index.js`.

### Handler return type

Use `'application/json' as const` (or `satisfies $Output`) to keep the
literal narrow:

```ts
return {
  encoding: 'application/json' as const,
  body: { preferences },
}

// or
return {
  encoding: 'application/json',
  body: { preferences },
} satisfies app.bsky.actor.getPreferences.$Output
```

Without `as const`, TypeScript widens to `string` and the return type
won't match. This is a type-level change only.

### LXM references

```ts
const lxm = app.bsky.actor.getPreferences.$lxm
const aud = computeProxyTo(ctx, req, lxm)
permissions.assertRpc({ aud, lxm })
```

### Parameter types

```diff
- import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/getAuthorFeed'
+ import { app } from '../../../../lexicons/index.js'

- type Params = QueryParams
+ type Params = app.bsky.feed.getAuthorFeed.$Params
```

### Output types

```ts
return {
  encoding: 'application/json' as const,
  body: { actor, relationships },
} satisfies app.bsky.graph.getRelationships.$Output
```

### Record / object types

```diff
- import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
+ // From a centralized types file, or directly:
+ import { app } from '../lexicons/index.js'
+ type PostRecord = app.bsky.feed.post.Main
```

### Defs

```diff
- import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'
+ type StatusAttr = com.atproto.admin.defs.StatusAttr
```

When constructing a value that needs `$type`, use `$build()`:

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

Plain shapes that don't need `$type` — just annotate:

```ts
const code: com.atproto.server.defs.InviteCode = {
  /* ... */
}
```

### Token values

```diff
- import { CURATELIST, MODLIST } from '../../../../lexicon/types/app/bsky/graph/defs'
+ import { app } from '../../../../lexicons/index.js'
+ const CURATELIST = app.bsky.graph.defs.curatelist.value
+ const MODLIST = app.bsky.graph.defs.modlist.value
```

### NSID string constants — `ids.*` → `$type` / `$lxm`

```diff
- import { ids } from '../../../lexicon/lexicons'
- if (uri.collection === ids.AppBskyGraphList) {
+ import { app } from '../../../lexicons/index.js'
+ if (uri.collection === app.bsky.graph.list.$type) {
```

For LXM checks in auth code:

```diff
- method === ids.AppBskyFeedGetFeedSkeleton
+ method === app.bsky.feed.getFeedSkeleton.$lxm
```

For simple comparisons in utility code, plain string literals are also
acceptable:

```diff
- if (uri.collection === ids.AppBskyFeedPost) {
+ if (uri.collection === 'app.bsky.feed.post') {
```

## 5. Type strictness — branded types

Apply branded types at type boundaries (function signatures, interface
fields, DB schema types) while keeping runtime code unchanged where
possible. See [data-model.md](data-model.md) for the full list and rules.
Common cases:

```diff
- did: string
+ did: DidString

- handle: string
+ handle: HandleString

- handleOrDid: string
+ handleOrDid: AtIdentifierString

- iss: string
+ iss: DidString | `${DidString}#${string}`

- indexedAt: string
+ indexedAt: DatetimeString
```

Replace string-prefix checks with type guards:

```diff
- if (typeof iss !== 'string' || !iss.startsWith('did:')) {
+ if (typeof iss !== 'string' || !isDidString(iss)) {
```

At data-plane / Kysely / protobuf boundaries, cast at the entry point:

```diff
- suggestedDids: dids,
+ suggestedDids: dids as DidString[],

- qb.where('actor.did', '=', filter.sub!)
+ qb.where('actor.did', '=', filter.sub! as DidString)

- post: { uri: item.uri, cid: item.cid || undefined },
+ post: { uri: item.uri as AtUriString, cid: item.cid || undefined },
```

`HeadersMap` for `Record<string,string>` headers:

```diff
- import { HeadersMap } from '@atproto/xrpc'
+ import { Headers as HeadersMap } from '@atproto/xrpc-server'
```

## 7. Schema validation / type guards

### `$matches()` — validates unknown data

When data hasn't been pre-validated:

```diff
- import { isRepoRef } from '../../../../lexicon/types/com/atproto/admin/defs'
- if (isRepoRef(subject)) { ... }
+ if (com.atproto.admin.defs.repoRef.$matches(subject)) { ... }
```

```diff
- repost: isSkeletonReasonRepost(item.reason) ? ... : undefined,
+ repost: app.bsky.feed.defs.skeletonReasonRepost.$matches(item.reason) ? ... : undefined,
```

### `$isTypeOf` — discriminates pre-validated unions

When data is already validated, only the `$type` tag matters. Faster
than `$matches`:

```diff
- const personalDetailsPref = prefs.find(
-   (pref) => pref.$type === 'app.bsky.actor.defs#personalDetailsPref'
- )
+ const personalDetailsPref = prefs.find(
+   app.bsky.actor.defs.personalDetailsPref.$isTypeOf,
+ )
```

`$isTypeOf` is a type-predicate; TS narrows automatically in `.find` /
`.filter` / `if`.

### `$build()` — typed object construction

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

`$build()` sets `$type` and types the result.

## XrpcError

```diff
- import { XRPCError } from '@atproto/xrpc'
+ import { XrpcError } from '@atproto/lex'
```

(Note: `@atproto/xrpc-server` still exports its own `XRPCError` class for
**throwing** server-side. The client-side error class is `XrpcError` from
`@atproto/lex`.)

## Tests in this phase

Tests still rely exclusively on `@atproto/api`. When tests previously
imported from `src/lexicon/`, redirect those imports to `@atproto/api`:

```diff
- import { ids } from '../../src/lexicon/lexicons'
- import { RepoRef, isRepoRef } from '../../src/lexicon/types/com/atproto/admin/defs'
- import { $Typed } from '../../src/lexicon/util'
+ import { $Typed, AtpAgent, ComAtprotoAdminDefs, ids } from '@atproto/api'
```

Don't change how tests make XRPC calls — they keep using `AtpAgent`. This
keeps tests stable as a runtime regression check during the migration.

## Common pitfalls

1. **`$type` vs `$lxm` vs `$nsid`**: `$type` for record/object type
   strings (`app.bsky.feed.post.$type` = `'app.bsky.feed.post'`). `$lxm`
   for XRPC method ids (auth/proxy). `$nsid` for the raw NSID — useful
   for defs that have no `main` type but still need the NSID.
2. **`$matches` vs `$isTypeOf`**: `$matches` for unvalidated data;
   `$isTypeOf` for pre-validated unions where only the `$type` tag
   matters.
3. **Branded type casts at boundaries**: data from protobuf / data plane
   / Kysely arrives as plain strings — cast (`as DidString`,
   `as AtUriString`) at entry, not later.
4. **`'application/json' as const`**: required on handler returns, or
   the inferred `string` type breaks the schema match.
5. **Response header changes** (in calls _out_ — see
   [lexification-client.md](lexification-client.md)): `result.data` →
   `result.body`, header object → `Headers` with `.get()`.
6. **`@atproto/lex-data` vs `@atproto/lex`**: `Cid`, `parseCid`,
   `BlobRef` are in `@atproto/lex-data` and re-exported from
   `@atproto/lex`. Either import path works.
7. **Prefer `@atproto/lex` over `@atproto/syntax`** for shared symbols
   (`DidString`, `AtUriString`).
8. **Avoid `assert()`** — use type guards (`isDidString`, `isHandleString`)
   with conditional logic instead.

## Import source changes summary

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
