# Data model: types, JSON, CBOR, branded strings, blobs

The AT Protocol data model extends JSON with two extra primitives — **CIDs**
(content-addressed links) and **bytes** (raw binary). It can be encoded as JSON
or as CBOR. `@atproto/lex` re-exports most of what you need; the underlying
packages are `@atproto/lex-data` (types) and `@atproto/lex-json` (JSON helpers).

## Lex value types

```ts
import type {
  LexValue,
  LexMap,
  LexScalar,
  TypedLexMap,
  Cid,
} from '@atproto/lex'
import { isLexValue, isLexMap, isTypedLexMap, isCid } from '@atproto/lex'

// LexScalar:    number | string | boolean | null | Cid | Uint8Array
// LexValue:     LexScalar | LexValue[] | { [key: string]?: LexValue }
// LexMap:       { [key: string]?: LexValue }
// TypedLexMap:  LexMap & { $type: string }

if (isTypedLexMap(data)) {
  data.$type // string
}
```

## CIDs

A `Cid` is an objet interface that represents a parsed CID string (`CidString`).

```ts
import { Cid, parseCid, ifCid, isCid } from '@atproto/lex'

const cidString: CidString = 'bafyreiabc...'

const cidMaybe: Cid | null = parseCidSafe(CidString)
const cid: Cid = parseCid(CidString) // throws on invalid
const maybe = ifCid(unknownValue) // Cid | undefined
isCid(unknownValue) // type guard
```

In Lex JSON, CIDs are encoded as `{ "$link": "bafyrei..." }`.

## Bytes

Binary data is `Uint8Array` in Lex; JSON-encoded as
`{ "$bytes": "base64..." }`.

## JSON ↔ Lex

`@atproto/lex-json` (re-exported from `@atproto/lex`) provides four
helpers:

| Function       | Direction         | Input           | Output                                |
| -------------- | ----------------- | --------------- | ------------------------------------- |
| `lexParse`     | JSON string → Lex | `string`        | `LexValue` (with `Cid`, `Uint8Array`) |
| `lexStringify` | Lex → JSON string | `LexValue`      | `string`                              |
| `jsonToLex`    | parsed JSON → Lex | plain JS object | `LexValue`                            |
| `lexToJson`    | Lex → plain JS    | `LexValue`      | plain JS object                       |

```ts
import { lexParse, lexStringify, jsonToLex, lexToJson, Cid } from '@atproto/lex'

// Parse JSON string into Lex (decodes $link / $bytes)
const parsed = lexParse<{ ref: Cid; data: Uint8Array }>(`{
  "ref": { "$link": "bafyrei..." },
  "data": { "$bytes": "SGVsbG8sIHdvcmxkIQ==" }
}`)

// Serialize Lex to JSON (encodes $link / $bytes)
const json = lexStringify({ ref: someCid, data: someBytes })

// Convert between parsed JSON objects and Lex values
const lex = jsonToLex({
  ref: { $link: 'bafyrei...' },
  data: { $bytes: 'SGVsbG8sIHdvcmxkIQ==' },
})
const obj = lexToJson({ ref: someCid, data: someBytes })
```

`lexParse<T>()` accepts a type parameter — no `as` cast needed:

```ts
const sub =
  lexParse<app.bsky.notification.defs.SubjectActivitySubscription>(json)
```

Low-level encode/decode for individual fields (rarely needed):

```ts
import {
  parseLexLink,
  encodeLexLink,
  parseLexBytes,
  encodeLexBytes,
} from '@atproto/lex'

parseLexLink({ $link: 'bafy...' }) // Cid (throws on invalid)
encodeLexLink(someCid) // { $link: '...' }
parseLexBytes({ $bytes: 'SGVsbG8=' }) // Uint8Array (throws on invalid)
encodeLexBytes(new Uint8Array([1, 2, 3])) // { $bytes: '...' }
```

## CBOR (DRISL)

CBOR encoding is in a **separate** package, `@atproto/lex-cbor`. It is not
re-exported from `@atproto/lex`.

```ts
import { encode, decode } from '@atproto/lex-cbor'
import type { LexValue } from '@atproto/lex'

const cborBytes: Uint8Array = encode(someLexValue)
const value: LexValue = decode(cborBytes)

const valueCasted = decode<{ foo: LexValue }>(cborBytes)
```

Use CBOR for repo storage, signed records, and anywhere [DRISL](https://dasl.ing/drisl.html)
deterministic encoding is required.

## Datetime strings

AT Protocol datetimes are a branded string type — `DatetimeString` — with
strict format requirements. `Date.prototype.toISOString()` is **not**
guaranteed to produce a conforming value (e.g. for years outside 0–9999).
Always use the helpers:

```ts
import {
  DatetimeString,
  toDatetimeString,
  asDatetimeString,
  currentDatetimeString,
  isDatetimeString,
  ifDatetimeString,
} from '@atproto/lex'

currentDatetimeString() // DatetimeString — now
toDatetimeString(new Date('2024-01-15')) // throws on invalid
asDatetimeString('2024-01-15T12:30:00Z') // validates + casts a string
isDatetimeString(value) // type guard
ifDatetimeString(value) // DatetimeString | undefined
```

Use them for `createdAt`, `indexedAt`, etc. on records and DB schemas:

```ts
import type { DatetimeString } from '@atproto/lex'

interface Row {
  did: DidString
  indexedAt: DatetimeString
}
```

## Branded string types

`@atproto/lex` exports nominal-typed strings for AT Protocol identifiers.
They prevent mixing untyped `string`s with validated identifiers.

| Type                 | Format                   | Type guard             |
| -------------------- | ------------------------ | ---------------------- |
| `DidString`          | `did:method:specific-id` | `isDidString`          |
| `HandleString`       | DNS-style handle         | `isHandleString`       |
| `AtIdentifierString` | DID **or** handle        | `isAtIdentifierString` |
| `AtUriString`        | `at://…`                 | `isAtUriString`        |
| `UriString`          | any URI                  | (validated by lex)     |
| `DatetimeString`     | AT Proto datetime        | `isDatetimeString`     |

```ts
import {
  DidString,
  HandleString,
  AtIdentifierString,
  AtUriString,
  isDidString,
  isHandleString,
  isAtIdentifierString,
} from '@atproto/lex'

if (typeof iss === 'string' && isDidString(iss)) {
  // iss: DidString
}
```

> [!NOTE]
>
> Some of these string formats are also exported from `@atproto/syntax`.
> **Prefer `@atproto/lex` imports** — they are the canonical home and integrate
> with generated schemas.

### Casting at boundaries

Data from protobuf, data plane responses, and Kysely queries arrives as
`string`. Cast at the entry point rather than asserting later:

```ts
suggestedDids: dids as DidString[],
qb.where('actor.did', '=', filter.sub! as DidString)
post: { uri: item.uri as AtUriString, cid: item.cid || undefined },
```

Avoid `assert()` calls — use type guards (`asAtUriString`, `assertAtUriString`,
`isDidString`, etc.) where you need a runtime check, and `as` casts at
known-safe boundaries.

## Blob references

Two formats coexist on the network:

```ts
// Modern — what new uploads always look like
type TypedBlobRef = {
  $type: 'blob'
  ref: Cid
  mimeType: string
  size: number
}

// Legacy — still appears in older records
type LegacyBlobRef = {
  cid: string // CID as string, not Cid
  mimeType: string // no size
}

type BlobRef = TypedBlobRef | LegacyBlobRef
```

```ts
import {
  BlobRef,
  TypedBlobRef,
  LegacyBlobRef,
  isBlobRef,
  isTypedBlobRef,
  isLegacyBlobRef,
  getBlobCid,
  getBlobCidString,
  getBlobMime,
  getBlobSize,
} from '@atproto/lex'

if (isTypedBlobRef(blob)) {
  blob.ref // Cid
  blob.size // number
} else if (isLegacyBlobRef(blob)) {
  blob.cid // string
}

// Format-agnostic helpers
getBlobCid(blob) // Cid
getBlobCidString(blob) // string (faster than getBlobCid(...).toString())
getBlobMime(blob) // string
getBlobSize(blob) // number | undefined (legacy refs lack size)
```

**Always create new blobs as `TypedBlobRef`.** The PDS upload endpoint
returns one. Reading code must handle both formats — use the helpers
above or check with `isTypedBlobRef` / `isLegacyBlobRef`.

`BlobRef` is no longer a class — `instanceof BlobRef` from
`@atproto/lexicon` is replaced by `isBlobRef` / `isTypedBlobRef`.

Validation behavior:

- `strict: true` (default): legacy blob refs are **rejected**.
- `strict: false`: legacy blob refs accepted. Setting
  `strictResponseProcessing: false` on a `Client` enables this for all
  responses.

## String length helpers

Lexicon string constraints can be measured in graphemes (user-perceived
characters) or UTF-8 bytes:

```ts
import { graphemeLen, utf8Len } from '@atproto/lex'

graphemeLen('👨‍👩‍👧‍👦') // 1
utf8Len('👨‍👩‍👧‍👦') // 25
```

## Other utilities

```ts
import {
  isLanguageString, // BCP-47 validation: 'en', 'pt-BR', etc.
  lexEquals, // deep equality across CIDs/bytes/etc.
} from '@atproto/lex'

isLanguageString('en-US') // true
lexEquals(a, b) // boolean
```
