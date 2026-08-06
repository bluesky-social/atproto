# Constants, guards, and branded types

Read this for steps 4 and 6: replacing `ids.*`, the generated `isX()` guards,
token constants, and hand-written `$type` literals; then tightening string
types at boundaries.

## `ids.*` → `$type` / `$lxm`

The `ids` object is gone. Which accessor replaces it depends on what the
string is _for_:

```diff
- import { ids } from '../../../lexicon/lexicons'
- if (uri.collection === ids.AppBskyGraphList) {
+ import { app } from '../../../lexicons/index.js'
+ if (uri.collection === app.bsky.graph.list.$type) {
```

```diff
- method === ids.AppBskyFeedGetFeedSkeleton
+ method === app.bsky.feed.getFeedSkeleton.$lxm
```

- `$type` — record and object type strings (collections, union tags).
- `$lxm` — XRPC method ids (auth scopes, proxy targets).
- `$nsid` — the raw NSID; the fallback for `defs` documents that define no
  `main` type and therefore have no `$type`.

Use the accessor, not a string literal. A literal is untracked when an NSID is
renamed and invisible to the tree-shaking that keeps generated output small.

## `isX()` → `$isTypeOf` or `$matches`

Legacy codegen emitted one `isX()` per definition that checked only the
`$type` field. The new tree splits that into two accessors, and choosing
correctly matters:

- **`$isTypeOf`** — reads the `$type` tag only. A type predicate, so TS
  narrows automatically inside `.find()` / `.filter()` / `if`. Correct for
  discriminating a union whose members were already validated (schema output,
  hydrated views, anything that came through `$parse`).
- **`$matches`** — validates the entire value against the schema. Correct
  when the data's shape is not yet guaranteed: raw records off the firehose,
  values out of the datastore, third-party input.

`$isTypeOf` is the direct behavioral equivalent of the old `isX()`, and it is
what the real migration used:

```diff
- import { isRepoRef } from '../../../../lexicon/types/com/atproto/admin/defs'
- if (isRepoRef(subject)) { … }
+ if (com.atproto.admin.defs.repoRef.$isTypeOf(subject)) { … }
```

```diff
- repost: isSkeletonReasonRepost(item.reason) ? … : undefined,
+ repost: app.bsky.feed.defs.skeletonReasonRepost.$isTypeOf(item.reason) ? … : undefined,
```

Hand-written `$type` comparisons collapse the same way:

```diff
- prefs.find((pref) => pref.$type === 'app.bsky.actor.defs#personalDetailsPref')
+ prefs.find(app.bsky.actor.defs.personalDetailsPref.$isTypeOf)
```

Reach for `$matches` deliberately, at the point where untrusted data enters —
in `bsky` that is the record indexing plugins and hydration, in `pds` it is
re-reading a stored record. Both packages use it a dozen times total against
~50 uses of `$isTypeOf`.

Validation that returns a result rather than a boolean is `$safeValidate` (or
`$validate` to throw). See [lex-schema](../../lex-schema/SKILL.md).

## Token values

```diff
- import { CURATELIST, MODLIST } from '../../../../lexicon/types/app/bsky/graph/defs'
+ import { app } from '../../../../lexicons/index.js'
+ const CURATELIST = app.bsky.graph.defs.curatelist.$token
+ const MODLIST = app.bsky.graph.defs.modlist.$token
```

Use `$token`, per [STYLE_GUIDE.md](../../../../STYLE_GUIDE.md). It reads as one
of the `$`-prefixed schema constants (`$type`, `$lxm`, `$nsid`) rather than as a
field on the value. Some older call sites use `.value`, which resolves to
the same string — replace them if you are editing that file.

## `$build()` for `$type`-carrying values

Object literals that hand-wrote a `$type` field:

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

`$build` fills in `$type` and types the result, so a renamed definition
becomes a compile error instead of a silently wrong tag. It is also how
subscription messages are emitted (see
[routes.md](routes.md#subscriptions)).

Values that carry no `$type` need no builder — a type annotation is enough,
and that is what most def usages become:

```ts
type CodeDetail = com.atproto.server.defs.InviteCode
```

## Centralized type-alias files

A package with a `types.ts` re-exporting from `src/lexicon/types/…` repoints
it at the generated tree. `packages/bsky/src/views/types.ts` is the live
example; copy its conventions rather than inventing names:

```ts
import { app, com } from '../lexicons/index.js'

export type ProfileRecord = app.bsky.actor.profile.Main
export const isProfileRecordType = app.bsky.actor.profile.$isTypeOf

export type StrongRef = com.atproto.repo.strongRef.Main
export const validateStrongRef = com.atproto.repo.strongRef.$safeValidate
```

- Types: `export type Foo = ns.path.TypeName` — `.Main` for the main
  definition, the def's own name otherwise.
- Guards: `export const isFooType = ns.path.$isTypeOf`. The `…Type` suffix is
  intentional; it distinguishes a tag check from a full validation and avoids
  colliding with the legacy `isFoo` names being replaced.
- Validators: `export const validateFoo = ns.path.$safeValidate`.

Grouping by NSID prefix with a comment header keeps a 200-line alias file
navigable.

## Branded strings

Apply at type boundaries — function signatures, interface fields, DB row
types — and leave runtime code alone:

```diff
- did: string                → did: DidString
- handle: string             → handle: HandleString
- handleOrDid: string        → handleOrDid: AtIdentifierString
- indexedAt: string          → indexedAt: DatetimeString
- iss: string                → iss: DidString | `${DidString}#${string}`
```

Replace prefix sniffing with the real guards:

```diff
- if (typeof iss !== 'string' || !iss.startsWith('did:')) {
+ if (typeof iss !== 'string' || !isDidString(iss)) {
```

Prefer guards over assertion helpers: a guard lets the caller decide what a
malformed value means, while an assertion turns it into a 500.

Data crossing a boundary TypeScript can't see — protobuf messages, Kysely
rows, `JSON.parse` — arrives as plain `string`. Cast once, at that entry
point:

```diff
- suggestedDids: dids,
+ suggestedDids: dids as DidString[],

- qb.where('actor.did', '=', filter.sub!)
+ qb.where('actor.did', '=', filter.sub! as DidString)
```

Casting later, after the value has been passed around, means every
intermediate signature stays `string` and the brand buys nothing.

These types are re-exported from `@atproto/syntax` unchanged, so
`import { DidString } from '@atproto/lex'` and
`from '@atproto/syntax'` are the same type — migrated files use both, and
files already importing other things from `@atproto/syntax` keep doing so.
Full list and semantics: [lex-data skill](../../lex-data/SKILL.md).
