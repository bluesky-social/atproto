# Working with generated schemas

Each Lexicon document compiled by `lex build --indexFile` produces a TypeScript
module that exposes runtime helpers and types. All of them are addressed via the
namespace tree (`app.bsky.feed.post`, `com.atproto.repo.getRecord`, …).

```ts
import { app, com } from './lexicons/index.js'
```

## Schema accessors

Every schema (record, object def, query, procedure, subscription) carries
a uniform set of `$`-prefixed properties.

| Accessor  | Returns                                                                                                     | Use                                       |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `$nsid`   | NSID string (`'app.bsky.feed.defs'`)                                                                        | Reference the lexicon doc itself          |
| `$type`   | `$type` string for record/object schemas (`'app.bsky.feed.post'`, `'app.bsky.actor.defs#profileViewBasic'`) | Compare/discriminate, set `$type` on data |
| `$lxm`    | LXM (XRPC method id) for query/procedure schemas                                                            | Auth checks, proxy routing                |
| `$Params` | TS type of query/procedure input params                                                                     | Handler param typing                      |
| `$Output` | TS type of query/procedure response body                                                                    | `satisfies` clauses on handler returns    |
| `.Main`   | TS type of a record/object's main definition                                                                | `let post: app.bsky.feed.post.Main`       |

Sub-definitions are accessed as siblings of `.Main` (e.g.
`app.bsky.feed.post.ReplyRef`, `app.bsky.feed.defs.PostView`).

## Validation methods (cheat sheet)

| Method                       | Throws? | Validates?              | Coerces / applies defaults? | Use when                                     |
| ---------------------------- | ------- | ----------------------- | --------------------------- | -------------------------------------------- |
| `$assert(data)`              | yes     | yes                     | no                          | Type-assertion                               |
| `$check(data)`               | yes     | yes                     | no                          | Runtime assertion, but does not narrow types |
| `$matches(data)`             | no      | yes (boolean)           | no                          | Same as `$check`, more common name           |
| `$isTypeOf(data)`            | no      | **only checks `$type`** | no                          | Already-validated unions/arrays              |
| `$parse(data, opts?)`        | yes     | yes                     | yes                         | Parse untrusted JSON, get clean value        |
| `$safeParse(data, opts?)`    | no      | yes                     | yes                         | Parse with `result.success` discriminant     |
| `$validate(data, opts?)`     | yes     | yes                     | no                          | Confirm an existing value matches as-is      |
| `$safeValidate(data, opts?)` | no      | yes                     | no                          | Same, with discriminated result              |
| `$build(data)`               | no      | **no**                  | sets `$type`                | Construct a typed object literal             |

### `$assert` - type assertion

```ts
app.bsky.feed.post.$assert(data)
// data: app.bsky.feed.post.Main
```

## `$check` - runtime check

Same as `$assert` but without the type narrowing. Use only when working with generic schemas, and `.assert`/`.$assert` yields the following ts error:

> 'schema' needs an explicit type annotation.
> Assertions require every name in the call target to be declared with an explicit type annotation. `ts(2775)`

```ts
declare const schema: RecordSchema | ObjectSchema
schema.$check(data) // void
```

### `$matches` — type guard

```ts
if (app.bsky.feed.post.$check(data)) {
  // data: app.bsky.feed.post.Main
  console.log(data.text)
}
```

### `$isTypeOf` — fast discriminator (no validation)

Use on values you've already validated, especially in `.find` / `.filter`
over union arrays:

```ts
const personalDetails = prefs.find(
  app.bsky.actor.defs.personalDetailsPref.$isTypeOf,
)
```

This skips schema validation — it only checks the `$type` tag.

### `$parse` / `$safeParse` — parse + validate

```ts
// Throws on invalid
const post = app.bsky.feed.post.$parse(unknownData)

// Discriminated result
const result = app.bsky.feed.post.$safeParse(unknownData)
if (result.success) {
  result.value // typed
} else {
  result.error // StandardSchemaV1.FailureResult
}
```

Parsing applies schema defaults and coerces JSON forms (e.g. `{$link: …}`
strings into `Cid` instances), so the output may differ from the input.

### `$validate` / `$safeValidate` — validate without coercion

Returns the original value unchanged if it already matches. Use when you
need to confirm a value is conformant **without** mutating it.

```ts
const same = app.bsky.feed.post.$validate(value)
same === value // true
```

### `$build` — construct without validating

Adds `$type` and types the result. **Does not validate** — use `$parse`
afterwards if you need both.

```ts
const post = app.bsky.feed.post.$build({
  text: 'Hello, world!',
  createdAt: currentDatetimeString(),
})
// post: app.bsky.feed.post.Main with $type set
```

For values that _don't_ need `$type` (plain object types from defs), just
use the namespace type as a TS annotation — no runtime call needed:

```ts
const view: app.bsky.feed.defs.PostView = {
  /* ... */
}
```

## Strict mode

All validation methods accept `{ strict: boolean }`. Default is `true`.

| `strict: true` (default)                      | `strict: false`                        |
| --------------------------------------------- | -------------------------------------- |
| Datetime strings must include a timezone      | Datetimes without timezone accepted    |
| Blob MIME types and size constraints enforced | MIME and size constraints not enforced |
| Only raw CIDs allowed in blob refs            | Any valid CID allowed                  |
| Legacy blob refs (`{cid, mimeType}`) rejected | Legacy blob refs accepted              |

```ts
schema.$safeParse(data) // strict: true (default)
schema.$safeParse(data, { strict: false }) // lenient
schema.$validate(data, { strict: false })
```

The `Client` constructor's `strictResponseProcessing` option threads
through to response validation — set it to `false` to accept legacy/lenient
responses across all calls. See [client.md](client.md).

## Token values

For lexicon `token` definitions, the constant is exposed via `.$token`:

```ts
const CURATELIST = app.bsky.graph.defs.curatelist.$token // 'app.bsky.graph.defs#curatelist'
```

Standard Schema validation runs in **parse mode** — defaults and coercion
apply to the output.

## Building schemas with `l`

To define schemas in code (rather than via JSON lexicons + `lex build`),
`@atproto/lex-schema` exports an `l` namespace that implements the Standard
Schema builder API:

```ts
import { l } from '@atproto/lex'

const myObj = l.typedObject('com.example.thing', {
  name: l.string(),
  count: l.optional(l.integer()),
})

type MyObj = l.Infer<typeof myObj> // { name: string; count?: number }
```

Common builders:

- Primitives: `l.string()`, `l.integer()`, `l.boolean()`, `l.bytes()`,
  `l.cid()`, `l.blob()`
- Composites: `l.object()`, `l.array()`, `l.union()`, `l.ref()`,
  `l.literal()`, `l.enum()`, `l.typedRef()`, `l.typedUnion()`
- Modifiers: `l.optional()`, `l.nullable()`, `l.withDefault()`
- Lexicon docs: `l.typedObject()`, `l.record()`, `l.query()`,
  `l.procedure()`, `l.subscription()`

The `l` namespace also exports the datetime helpers (`l.toDatetimeString`,
`l.currentDatetimeString`, `l.asDatetimeString`, `l.isDatetimeString`,
`l.ifDatetimeString`) so schema definitions can reference them.

In normal application code, **prefer the generated schemas** from
`./lexicons/`. Use `l.*` only when authoring a lexicon or one-off schema
inline.

## Standard Schema interface

Every schema implements [Standard Schema](https://standardschema.dev/) v1
via a `~standard` property. Use it with form/validation libraries that
support the spec:

```ts
const schema = app.bsky.feed.post
schema['~standard'].version // 1
schema['~standard'].vendor // '@atproto/lex-schema'
const result = schema['~standard'].validate(data)
if (!result.issues) {
  result.value // parsed
} else {
  result.issues // errors
}
```
