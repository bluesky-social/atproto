---
name: lex-schema
description: >
  Validate, parse, construct, and type AT Protocol data against Lexicon schemas
  with `@atproto/lex` / `@atproto/lex-schema`. Use whenever code reaches into a
  generated `./lexicons/` tree — `$parse`, `$safeParse`, `$validate`,
  `$matches`, `$assert`, `$build`, `$isTypeOf`, `$type`, `$nsid`, `$lxm`,
  `$Params`, `$Input`, `$Output`, `$Message`, `.Main` — when checking whether an
  unknown record or XRPC payload conforms, when loosening checks with
  `strict: false`, when declaring a schema by hand with the `l` builder, when
  handing a Lexicon schema to a Standard Schema consumer, or when replacing
  Zod/Ajv-style validation with Lexicon validation. Not for codegen setup (see
  lex-setup) nor for the value types themselves — CIDs, bytes, blobs, JSON/CBOR
  encoding, branded strings (see lex-data).
disable-model-invocation: false
---

# Generated schemas and the `l` builder

`lex build` compiles each Lexicon document into a TypeScript module carrying
both a runtime schema and its types, addressed by NSID dot-path through the
namespace tree:

```ts
import { app, com } from './lexicons/index.js'

app.bsky.feed.post // record schema
app.bsky.feed.defs.postView // object def schema
com.atproto.repo.createRecord // query/procedure schema
```

The tree lives in `./src/lexicons/` (plural), is gitignored, and is regenerated
by `lex build` — never edit it. See [lex-setup](../lex-setup/SKILL.md).

## Accessors on a generated namespace

| Accessor                | Schema kind             | What it is                                          |
| ----------------------- | ----------------------- | --------------------------------------------------- |
| `$nsid`                 | all                     | NSID of the document (`'app.bsky.feed.post'`)       |
| `$type`                 | record / typed object   | `$type` string; equals `$nsid` for `main`           |
| `$lxm`                  | query / procedure / sub | XRPC method ID — auth checks, proxy routing         |
| `$params` / `$Params`   | query / procedure / sub | Params schema / its parsed type                     |
| `$input` / `$Input`     | procedure               | Request payload schema / `{ encoding, body }` type  |
| `$InputBody`            | procedure               | Request body type alone                             |
| `$output` / `$Output`   | query / procedure       | Response payload schema / `{ encoding, body }` type |
| `$OutputBody`           | query / procedure       | Response body type alone                            |
| `$message` / `$Message` | subscription            | Message schema / message type                       |
| `.Main`                 | record / object         | The main definition's TS type                       |

`$Input` / `$Output` / `$InputBody` / `$OutputBody` take an optional binary-body
type parameter (`$Output<Buffer>`); the default is the opaque `l.BinaryData`
placeholder.

Sub-definitions sit alongside `.Main` — type in PascalCase, schema in camelCase:

```ts
type ReplyRef = app.bsky.feed.post.ReplyRef
app.bsky.feed.defs.postView // schema
type PostView = app.bsky.feed.defs.PostView // type
```

**Never write NSID string literals.** Use `$type` / `$lxm` / `$token`: the
schema stays the single source of truth and each constant is one shared string
instance (see [STYLE_GUIDE.md](../../../STYLE_GUIDE.md#lexicons)).

## Validation methods

Every schema exposes these as plain methods; generated `main` definitions also
re-export them as pre-bound `$`-prefixed consts, so
`const { $parse } = app.bsky.feed.post` and
`export const validateStrongRef = com.atproto.repo.strongRef.$safeValidate`
both work.

| Method                       | On invalid  | Transforms input?      | Returns                        |
| ---------------------------- | ----------- | ---------------------- | ------------------------------ |
| `$parse(data, opts?)`        | throws      | yes                    | parsed value (output type)     |
| `$safeParse(data, opts?)`    | result      | yes                    | `{ success, value }` \| error  |
| `$validate(data, opts?)`     | throws      | no                     | the _same_ value, narrowed     |
| `$safeValidate(data, opts?)` | result      | no                     | `{ success, value }` \| error  |
| `$assert(data, opts?)`       | throws      | no                     | `void`, narrows via `asserts`  |
| `$check(data, opts?)`        | throws      | no                     | `void`, no narrowing           |
| `$cast(data, opts?)`         | throws      | no                     | same as `$validate`            |
| `$matches(data, opts?)`      | `false`     | no                     | type-guard boolean             |
| `$ifMatches(data, opts?)`    | `undefined` | no                     | the value, or `undefined`      |
| `$isTypeOf(value)`           | `false`     | no — **no validation** | type-guard on `$type` only     |
| `$build(data)`               | n/a         | adds `$type` only      | typed literal, **unvalidated** |

### Parse vs. validate

The distinction is whether the schema may hand back a _different_ value.
`$parse` runs in parse mode: `withDefault` defaults are filled in, `l.bytes()`
normalizes any typed-array view to `Uint8Array`, a `TokenSchema` instance is
accepted in place of its string, and objects/arrays/params are copied on write
when a child transforms. `$validate` runs the same checks but treats any
transformation as a failure, so a success guarantees the input already
conformed as-is.

That guarantee is why validate mode is the right choice on the read path: the
AppView hydrates stored records with `$matches` / `$safeValidate` rather than
`$parse`, because a value with defaults applied would no longer hash to the CID
it was stored under.

Parse mode does **not** decode the Lex JSON encoding — `{ "$link": … }` stays a
plain object and fails CID validation. Convert first with `jsonToLex` /
`lexParse` from `@atproto/lex-json` (see [lex-data](../lex-data/SKILL.md)).

### Result shape

On failure the result _is_ a `LexValidationError` (the class implements the
failure shape), so `result.reason` is the error itself and `result.issues` is
the issue list. There is no `.error` payload object — `error` is the XRPC error
code string (`'InvalidRequest'`).

```ts
const result = app.bsky.feed.post.$safeParse(unknownData)
if (result.success) {
  result.value // app.bsky.feed.post.Main
} else {
  result.reason // LexValidationError (=== result)
  result.issues // readonly Issue[], each carrying a path
}
```

### `$assert` vs `$check`

`$assert` narrows via an `asserts` signature, which TypeScript only permits when
the call target has an explicit type annotation. In generic code that yields:

> Assertions require every name in the call target to be declared with an
> explicit type annotation. `ts(2775)`

`$check` is the same runtime check without the narrowing — reach for it only to
resolve that error.

```ts
declare const schema: RecordSchema | ObjectSchema
schema.$check(data) // void, no ts(2775)
```

### `$isTypeOf` — discriminate, don't validate

Only compares `$type`, so it is cheap enough for hot `.find` / `.filter` loops
over already-validated unions:

```ts
const pref = prefs.find(app.bsky.actor.defs.personalDetailsPref.$isTypeOf)
```

Mind the asymmetry: on a **record** schema it demands an exact `$type` match,
but on a **typed object** (def) schema a _missing_ `$type` also passes, since
`$type` is optional on nested defs. On unvalidated data it proves nothing about
the rest of the shape.

### `$build` — construct with `$type`, no validation

Records require `$type`, so hand-building one means repeating the NSID.
`$build` sets it and types the result; it applies no defaults and runs no
checks, so follow with `$parse` when the input is untrusted.

```ts
const post = app.bsky.feed.post.$build({
  text: 'Hello, world!',
  createdAt: l.currentDatetimeString(),
})
```

Defs whose `$type` is optional need no runtime call — annotate instead. Use
`Un$Typed<T>` when a helper returns a def's fields and the caller adds `$type`:

```ts
const view: app.bsky.feed.defs.PostView = {/* ... */}
function toPrefs(): Un$Typed<app.bsky.notification.defs.Preferences> {
  /* ... */
}
```

### Record keys

A record schema carries its key schema, for validating an rkey independently of
the record body:

```ts
const result = app.bsky.feed.post.keySchema.safeValidate(rkey)
```

## Strict mode

Every validating method takes `{ strict?: boolean, path?: PropertyKey[] }`,
strict defaulting to `true`. Strict means "conforms to the AT Protocol spec";
lenient exists because data already on the network predates parts of it.

| Concern         | `strict: true` (default)                  | `strict: false`                             |
| --------------- | ----------------------------------------- | ------------------------------------------- |
| `datetime`      | timezone required                         | any ISO-ish datetime                        |
| `at-uri`        | record-key component validated            | record key not validated                    |
| `language`      | RFC 5646 §4.1 semantics enforced          | well-formed BCP 47 syntax only              |
| blob constraint | `accept` MIME list and `maxSize` enforced | not enforced                                |
| blob ref CID    | strict CID check                          | any valid CID                               |
| legacy blob ref | `{ cid, mimeType }` rejected              | accepted, including the sentinel `size: -1` |

```ts
schema.$safeParse(data, { strict: false })
```

`Client`'s `strictResponseProcessing: false` threads this through every
response — prefer it over sprinkling per-call options. See
[lex-client](../lex-client/SKILL.md).

## Tokens

A Lexicon `token` def compiles to a schema instance whose constant is `$token`
(the instance also stringifies to it). Prefer `$token` — it sits with the other
`$`-prefixed schema constants, and [STYLE_GUIDE.md](../../../STYLE_GUIDE.md)
prescribes it. The `.value` property resolves to the same string, so older call
sites using it are correct, just not the house spelling:

```ts
app.bsky.graph.defs.curatelist.$token // 'app.bsky.graph.defs#curatelist'
```

## Declaring schemas with `l`

Generated schemas cover anything backed by a Lexicon document. Use the `l`
builder for one-off internal shapes, or when authoring a schema before its
Lexicon JSON exists — otherwise prefer `./lexicons/`, which stays in sync with
the contract.

```ts
import { l } from '@atproto/lex'

const thing = l.typedObject(
  'com.example.thing', // NSID
  'main', // definition name
  l.object({
    name: l.string({ maxGraphemes: 64 }),
    count: l.optional(l.withDefault(l.integer({ minimum: 0 }), 0)),
  }),
)

type Thing = l.Infer<typeof thing> // input type; l.InferOutput for post-parse
```

Note the shape: document builders take `(nsid, name, validator)` — a validator,
not a bare property map. `l.object()` is what turns a property map into one.

- Primitives — `l.string()`, `l.integer()`, `l.boolean()`, `l.bytes()`,
  `l.cid()`, `l.blob()`, `l.null()`, `l.never()`, `l.unknown()`, `l.lexMap()`,
  `l.lexValue()`
- Composites — `l.object()`, `l.array()`, `l.dict()`, `l.union()`,
  `l.discriminatedUnion()`, `l.intersection()`, `l.ref()`, `l.literal()`,
  `l.enum()`, `l.regexp()`, `l.refine()`, `l.custom()`
- Modifiers — `l.optional()`, `l.nullable()`, `l.withDefault()`
- Lexicon documents — `l.record()`, `l.typedObject()`, `l.typedRef()`,
  `l.typedUnion()`, `l.token()`, `l.query()`, `l.procedure()`,
  `l.subscription()`, `l.params()`, `l.payload()`, `l.jsonPayload()`

`l` also carries the schema classes (`RecordSchema`, `ObjectSchema`, …), the
inference helpers (`l.Infer`, `l.InferInput`, `l.InferOutput`), the branded
string types and format guards, and the datetime helpers
(`l.currentDatetimeString`, `l.toDatetimeString`, `l.asDatetimeString`,
`l.isDatetimeString`, `l.ifDatetimeString`).

`@atproto/lex` re-exports all of it flat as well, but importing `l` avoids
colliding with globals and generic names (`string`, `object`, `record`).

`ParamsSchema` additionally exposes `fromURLSearchParams()` (coercing each
string to the declared scalar type) and `toURLSearchParams()` — use these
instead of hand-rolled query-string handling.

## Standard Schema

Every schema implements [Standard Schema](https://standardschema.dev/) v1 via
`~standard`, so form libraries and validators speaking the spec accept a
Lexicon schema directly:

```ts
const result = app.bsky.feed.post['~standard'].validate(data)
if (!result.issues) result.value
```

The adapter always runs in **parse mode**, so defaults and coercion apply even
where a caller might expect a pure check.

## Related skills

[lex-setup](../lex-setup/SKILL.md) generates this tree;
[lex-data](../lex-data/SKILL.md) covers the values these schemas validate
(CIDs, bytes, blobs, JSON/CBOR, branded strings);
[lex-client](../lex-client/SKILL.md) and
[xrpc-server](../xrpc-server/SKILL.md) cover passing schemas to calls and
routes.
