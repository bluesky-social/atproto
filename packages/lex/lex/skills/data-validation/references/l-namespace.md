# `l` Namespace API Reference

The `l` namespace from `@atproto/lex-schema` provides imperative schema builders
for constructing AT Protocol validators. Import it as:

```ts
import { l } from '@atproto/lex-schema'
```

---

## Primitive Types

### l.string(options?)

Creates a `StringSchema` for UTF-8 string validation.

**Options:**
- `minLength` / `maxLength` - byte length (UTF-8)
- `minGraphemes` / `maxGraphemes` - grapheme cluster count
- `format` - built-in format validator (e.g. `'at-uri'`, `'did'`, `'handle'`, `'datetime'`)
- `knownValues` - array of expected values (non-restrictive)
- `enum` - array of allowed values (restrictive)
- `const` - single allowed value

```ts
const handle = l.string({ format: 'handle' })
const status = l.string({ enum: ['active', 'inactive'] })
const bio = l.string({ maxGraphemes: 256, maxLength: 2560 })
```

**Parse-mode coercion:** accepts `Date`, `URL`, `TokenSchema`, and `String` objects.
Rejects `number` and `boolean`.

### l.integer(options?)

Creates an `IntegerSchema`. Uses `Number.isSafeInteger()` and rejects all floats.

**Options:** `minimum`, `maximum`, `enum`, `const`

```ts
const age = l.integer({ minimum: 0, maximum: 150 })
const priority = l.integer({ enum: [1, 2, 3] })
```

### l.boolean()

Creates a `BooleanSchema`. No options.

```ts
const flag = l.boolean()
```

### l.bytes(options?)

Creates a `BytesSchema` for binary data.

**Options:** `minLength`, `maxLength`

### l.cid(options?)

Creates a `CidSchema` for content identifiers.

**Options:** `flavor` - `'raw'` | `'cbor'` | `'dasl'`

### l.blob(options?)

Creates a `BlobSchema` for blob references.

**Options:**
- `accept` - array of MIME patterns (e.g. `['image/*', 'video/mp4']`)
- `maxSize` - maximum size in bytes
- `allowLegacy` - accept legacy blob format

```ts
const avatar = l.blob({ accept: ['image/png', 'image/jpeg'], maxSize: 1_000_000 })
```

### l.null()

Creates a `NullSchema`. Matches only `null`.

### l.never()

Creates a `NeverSchema`. Always fails validation.

---

## Composite Types

### l.array(validator, options?)

Creates an `ArraySchema` wrapping an item validator.

**Options:** `minLength`, `maxLength`

```ts
const tags = l.array(l.string({ maxLength: 640 }), { maxLength: 8 })
```

**Behavior:** copy-on-write -- the array is only copied if any item is transformed
during parsing.

### l.object(properties)

Creates an `ObjectSchema` from a properties map (string keys to validators).

```ts
const profile = l.object({
  displayName: l.optional(l.string({ maxGraphemes: 64 })),
  description: l.optional(l.string({ maxGraphemes: 256 })),
  avatar: l.optional(l.blob({ accept: ['image/*'] })),
})
```

**Behavior:** copy-on-write -- the object is only copied if any property value is
transformed during parsing.

### l.dict(keyValidator, valueValidator)

Creates a `DictSchema` for arbitrary key-value maps.

```ts
const metadata = l.dict(l.string(), l.string())
```

### l.union(validators)

Creates a `UnionSchema` that tries each validator in order.

```ts
const stringOrInt = l.union([l.string(), l.integer()])
```

### l.discriminatedUnion(discriminator, variants)

Creates a `DiscriminatedUnionSchema` with O(1) lookup on a discriminator field.
The discriminator must be a `LiteralSchema` or `EnumSchema`.

```ts
const shape = l.discriminatedUnion('kind', [
  l.object({ kind: l.literal('circle'), radius: l.integer() }),
  l.object({ kind: l.literal('rect'), width: l.integer(), height: l.integer() }),
])
```

### l.intersection(left, right)

Creates an `IntersectionSchema` requiring input to match both validators.

### l.enum(values)

Creates an `EnumSchema` from an array of allowed values.

```ts
const color = l.enum(['red', 'green', 'blue'])
```

### l.literal(value)

Creates a `LiteralSchema` matching a single exact value.

```ts
const version = l.literal(1)
```

### l.regexp(pattern)

Creates a `RegexpSchema` that validates strings against a regular expression.

---

## Modifiers

### l.optional(validator)

Creates an `OptionalSchema`. Makes a property optional in an object (accepts
`undefined`).

```ts
const obj = l.object({
  required: l.string(),
  notRequired: l.optional(l.string()),
})
```

### l.nullable(validator)

Creates a `NullableSchema`. Allows `null` in addition to the inner type.

```ts
const maybeString = l.nullable(l.string())
```

### l.withDefault(validator, defaultValue)

Creates a `WithDefaultSchema`. The default is applied in **parse mode only**.
In validate mode, defaults are NOT applied.

```ts
const count = l.withDefault(l.integer(), 0)

// Combined with optional:
const obj = l.object({
  limit: l.optional(l.withDefault(l.integer(), 50)),
})
// parse mode:    missing → 50
// validate mode: missing → undefined
```

### l.ref(getter)

Creates a `RefSchema` with a lazy getter function. Use for circular or
forward-referenced schemas.

```ts
const node: l.Validator = l.object({
  value: l.string(),
  children: l.array(l.ref(() => node)),
})
```

### l.refine(schema, refinement)

Creates a refined validator with custom validation logic on top of an existing
schema.

### l.custom(assertion, message, path?)

Creates a `CustomSchema` with a custom assertion function.

---

## Lexicon-Specific Types

### l.typedObject(nsid, hash, validator)

Creates a `TypedObjectSchema` -- an object that carries a `$type` field
(`nsid` + optional `#hash`).

```ts
const likeRecord = l.typedObject('app.bsky.feed.like', 'main', l.object({
  subject: l.object({ uri: l.string({ format: 'at-uri' }), cid: l.cid() }),
  createdAt: l.string({ format: 'datetime' }),
}))
```

### l.typedRef(getter)

Creates a `TypedRefSchema` -- a lazy reference specifically to a `typedObject`.

### l.typedUnion(refs, closed)

Creates a `TypedUnionSchema` -- a discriminated union on the `$type` field.

- **open** (`closed: false`): accepts unknown `$type` values
- **closed** (`closed: true`): rejects unknown `$type` values

```ts
const embed = l.typedUnion([
  () => imageEmbed,
  () => externalEmbed,
], false) // open union
```

### l.record(key, type, validator)

Creates a `RecordSchema` defining an AT Protocol record.

**Key types:** `'any'`, `'tid'`, `'nsid'`, `'self'`

### l.query(nsid, params, output, errors?)

Defines a query (GET) XRPC method.

### l.procedure(nsid, params, input, output, errors?)

Defines a procedure (POST) XRPC method.

### l.subscription(nsid, params, message, errors?)

Defines a subscription (WebSocket) XRPC method.

### l.params(properties?)

Creates a `ParamsSchema` for URL query parameters. Only `boolean`, `integer`,
and `string` types are allowed.

**Params coercion** (parse mode): `"true"` / `"false"` are coerced to booleans,
strings matching `/^-?\d+$/` are coerced to integers.

```ts
const queryParams = l.params({
  limit: l.optional(l.withDefault(l.integer({ minimum: 1, maximum: 100 }), 50)),
  cursor: l.optional(l.string()),
})
```

### l.payload(encoding?, validator?)

Defines a payload with MIME-type matching and an optional body validator.

### l.jsonPayload(properties)

Convenience for creating a JSON-encoded payload. Wraps `l.payload` with
`application/json` encoding.

### l.token(nsid, hash?)

Creates a `TokenSchema` with a `$type` field. Used for enum-like constants in
the AT Protocol.

### l.permission(resource, options?)

Defines a permission on a resource.

### l.permissionSet(nsid, perms, opts?)

Defines a named set of permissions.

---

## Utility Types

### l.unknown()

Creates an `UnknownSchema`. Accepts any value.

### l.lexValue()

Creates a `LexValueSchema` that accepts any valid AT Protocol value.

### l.lexMap()

Creates a `LexMapSchema` (alias: `unknownObject`). Accepts any plain object.

---

## Schema Methods

All validators expose the following methods:

### Assertion and Matching

| Method | Description |
|---|---|
| `schema.assert(input)` | Type assertion; throws on invalid input |
| `schema.check(input)` | Type assertion (avoids `ts(2775)` issue) |
| `schema.cast(input)` | Validate and return typed value, or throw |
| `schema.matches(input)` | Type guard returning `boolean` |
| `schema.ifMatches(input)` | Returns the value if valid, `undefined` otherwise |

### Parsing (with coercion)

| Method | Description |
|---|---|
| `schema.parse(input, options?)` | Parse with defaults/coercion; throws on invalid |
| `schema.safeParse(input, options?)` | Parse returning `{success, value}` or `{success, error}` |

### Strict Validation (no coercion)

| Method | Description |
|---|---|
| `schema.validate(input, options?)` | Strict validation; throws on invalid |
| `schema.safeValidate(input, options?)` | Strict validation returning `Result` |

**`validate` vs `parse`:** validate mode rejects any data that would require
transformation, including applying defaults. Use `parse` when accepting user
input; use `validate` when verifying already-normalized data.

### Dollar-Prefixed Aliases

Every method above has a `$`-prefixed alias: `$assert`, `$check`, `$cast`,
`$matches`, `$ifMatches`, `$parse`, `$safeParse`, `$validate`, `$safeValidate`.

```ts
// These are equivalent:
schema.parse(data)
schema.$parse(data)
```

---

## Type Inference

Extract TypeScript types from validators using utility types:

```ts
import type { InferInput, InferOutput, Infer } from '@atproto/lex-schema'

const profileSchema = l.object({
  displayName: l.string(),
  age: l.optional(l.integer()),
})

type ProfileInput = InferInput<typeof profileSchema>
// { displayName: string; age?: number | undefined }

type ProfileOutput = InferOutput<typeof profileSchema>
// { displayName: string; age?: number | undefined }

type Profile = Infer<typeof profileSchema>
// Alias for InferInput
```

---

## Key Behavioral Notes

1. **String lengths** (`minLength`, `maxLength`) count **UTF-8 bytes**, not
   characters or graphemes. Use `minGraphemes` / `maxGraphemes` for
   user-visible character counts.

2. **Copy-on-write:** `l.array` and `l.object` only allocate a new array/object
   if parsing transforms any element. If nothing changes, the original
   reference is returned.

3. **`l.optional(l.withDefault(...))`** behaves differently by mode:
   - `parse` mode: missing value becomes the default
   - `validate` mode: missing value stays `undefined`

4. **Discriminated union** requires `LiteralSchema` or `EnumSchema` on the
   discriminator field for O(1) dispatch.

5. **Typed union open vs closed:**
   - Open unions pass through objects with unrecognized `$type` values
   - Closed unions reject unrecognized `$type` values

6. **Params coercion** (parse mode only):
   - `"true"` / `"false"` become `true` / `false`
   - Strings matching `/^-?\d+$/` become integers
