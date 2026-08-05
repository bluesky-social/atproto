---
name: lex-data
description: >
  Represent, parse, serialize, hash, or convert AT Protocol data values with
  `@atproto/lex`. Use whenever code touches CIDs, raw bytes, `$link` / `$bytes`
  JSON, CBOR / DRISL encoding, blob references, or AT Protocol identifier and
  datetime strings — DIDs, handles, AT URIs, NSIDs, TIDs, record keys,
  `createdAt` / `indexedAt`. Applies when the ask sounds like "serialize this
  record", "hash these bytes", "why is this datetime rejected", "count the
  characters in this field", or when replacing `multiformats` CIDs,
  `new Date().toISOString()`, or hand-rolled base64. Read it before typing a
  DID, AT URI, or datetime as a bare `string`.
disable-model-invocation: false
---

# Data model: types, CIDs, JSON, CBOR, identifier strings, blobs

The AT Protocol data model is JSON plus two primitives — **CIDs**
(content-addressed links) and **bytes** (raw binary) — encodable as JSON or as
CBOR.

## Which package exports what

`@atproto/lex` re-exports `lex-data`, `lex-json`, `lex-schema` and
`lex-client`, so a package that already depends on it needs no extra import
path. `@atproto/lex-cbor` is **not** re-exported — depend on it explicitly.

| Symbols                                                       | Defined in                                              | Reachable via `@atproto/lex` |
| ------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| `LexValue`, `Cid`, blob refs, base64/utf8 helpers, `LexError` | `@atproto/lex-data`                                     | yes                          |
| `lexParse`, `lexStringify`, `jsonToLex`, `lexToJson`          | `@atproto/lex-json`                                     | yes                          |
| Identifier & datetime string types + guards                   | `@atproto/syntax`, re-exported by `@atproto/lex-schema` | yes                          |
| `encode`, `decode`, `decodeAll`, `cidForLex`                  | `@atproto/lex-cbor`                                     | **no**                       |

Low-level packages (`repo`, `common`, `xrpc-server`) import `@atproto/lex-data`
directly to avoid pulling in the client and schema layers.

> [!NOTE]
> This repo sets `verbatimModuleSyntax: true`, so type-only names need the
> `type` modifier — `import { type DidString, isDidString } from '@atproto/lex'`.
> All examples below follow that form.

## Lex value types

```ts
import {
  type LexValue,
  type TypedLexMap,
  isLexValue,
  isTypedLexMap,
} from '@atproto/lex'

// LexScalar:    number (integers only) | string | boolean | null | Cid | Uint8Array
// LexValue:     LexScalar | LexValue[] | { [key: string]?: LexValue }
// LexMap:       { [key: string]?: LexValue }
// TypedLexMap:  LexMap & { $type: string }
```

`isLexValue`, `isLexMap`, `isLexArray` and `isLexScalar` take `unknown`;
`isTypedLexMap` takes a `LexValue`, so narrow with `isLexValue` first when the
input is untyped. `isLexValue` walks the whole structure and rejects cycles,
non-integer numbers, and non-plain objects (`Date`, class instances,
functions) — it is not a cheap check, so avoid it on hot paths where a schema
already validates the value.

## CIDs

`Cid` is an interface, not a class. `@atproto/lex-data` defines it rather than
re-exporting `multiformats`' `CID`, because that class breaks under
`node16` / `bundler` module resolution. Treat `CID` and `asMultiformatsCID` as
deprecated escape hatches.

```ts
import {
  type Cid,
  asCid,
  decodeCid,
  ifCid,
  isCid,
  parseCid,
  parseCidSafe,
} from '@atproto/lex'

parseCid(str) // Cid — throws on invalid
parseCidSafe(str) // Cid | null
decodeCid(bytes) // Cid from binary form — throws on invalid
isCid(value) // type guard
ifCid(value) // Cid | null
asCid(value) // Cid — throws on invalid
```

Each accepts a `{ flavor }` option that additionally constrains the CID, which
is how you enforce that a blob CID really is a blob CID rather than trusting
the caller:

- `'raw'` — v1 + raw multicodec (blob content)
- `'cbor'` — v1 + dag-cbor + sha256 (records, MST nodes)
- `'dasl'` — either codec, v1 + sha256

For strings you already hold, `validateCidString(str, options)` returns a
boolean and also checks the string is the canonical encoding;
`ensureValidCidString` throws instead.

Creating CIDs — hashing is async because it goes through WebCrypto:

```ts
import {
  cidForCbor,
  cidForRawBytes,
  cidForRawHash,
  isCidForBytes,
} from '@atproto/lex'
import { cidForLex } from '@atproto/lex-cbor'

await cidForLex(record) // CBOR-encode then hash — the usual entry point
await cidForCbor(cborBytes) // hash bytes that are already CBOR
await cidForRawBytes(blobBytes) // raw CID for blob content
cidForRawHash(sha256Digest) // sync, when you already streamed the hash
await isCidForBytes(cid, bytes) // verify a CID matches its content
```

In Lex JSON, CIDs are encoded as `{ "$link": "bafyrei..." }`.

## Bytes

Binary data is `Uint8Array`; JSON-encoded as `{ "$bytes": "base64..." }`.
`@atproto/lex-data` ships the byte utilities so packages don't add their own
base64 dependency: `toBase64` / `fromBase64` (both take an optional
`'base64' | 'base64url'` alphabet), `utf8ToBase64` / `utf8FromBase64`,
`utf8FromBytes`, `ui8Concat`, `ui8Equals`, `asUint8Array`, `ifUint8Array`.

## JSON ↔ Lex

| Function       | Direction         | Input           | Output                                |
| -------------- | ----------------- | --------------- | ------------------------------------- |
| `lexParse`     | JSON string → Lex | `string`        | `LexValue` (with `Cid`, `Uint8Array`) |
| `lexStringify` | Lex → JSON string | `LexValue`      | `string`                              |
| `jsonToLex`    | parsed JSON → Lex | plain JS object | `LexValue`                            |
| `lexToJson`    | Lex → plain JS    | `LexValue`      | plain JS object                       |

`lexParse<T>()` takes a type parameter, so no `as` cast is needed:

```ts
import { lexParse, lexStringify } from '@atproto/lex'

const sub =
  lexParse<app.bsky.notification.defs.SubjectActivitySubscription>(json)
const out = lexStringify({ ref: someCid, data: someBytes })
```

`lexParse` and `jsonToLex` accept `{ strict }`, defaulting to **`false`**:
malformed `$link` / `$bytes` objects and non-integer numbers pass through
unchanged rather than throwing. Pass `{ strict: true }` when the input is
untrusted and a silently-wrong value would be worse than an exception.
`lexParseJsonBytes(bytes, options)` is the same parse starting from UTF-8
bytes.

Field-level encode/decode is rarely needed, but note the return contract —
these signal failure by returning `undefined`, they do not throw:

```ts
import {
  encodeLexBytes,
  encodeLexLink,
  parseLexBytes,
  parseLexLink,
} from '@atproto/lex'

parseLexLink({ $link: 'bafy...' }) // Cid | undefined
parseLexBytes({ $bytes: 'SGVsbG8=' }) // Uint8Array | undefined
encodeLexLink(someCid) // { $link: '...' }
encodeLexBytes(new Uint8Array([1, 2, 3])) // { $bytes: '...' }
```

## CBOR (DRISL)

Use CBOR for repo storage, signed records, CAR files, and event frames —
anywhere [DRISL](https://dasl.ing/drisl.html) deterministic encoding is
required. Add `@atproto/lex-cbor` as a dependency; it is not reachable through
`@atproto/lex`.

```ts
import { type LexValue } from '@atproto/lex'
import { cidForLex, decode, decodeAll, encode } from '@atproto/lex-cbor'

const bytes: Uint8Array = encode(someLexValue)
const value = decode<{ foo: LexValue }>(bytes)

// Concatenated values (CAR blocks, subscription frames)
for (const frame of decodeAll(buffer)) {
  /* … */
}
```

`encode` throws on anything the AT data model forbids: non-string map keys,
`undefined`, and non-integer numbers. That strictness is the point — it is what
makes the resulting CID stable.

## Datetime strings

`DatetimeString` is the branded type for AT Protocol datetimes.
`Date.prototype.toISOString()` is not guaranteed to conform (years outside
0–9999 serialize with a `±YYYYYY` prefix), so route `Date` → string through
the helpers rather than calling `toISOString()` directly:

```ts
import {
  type DatetimeString,
  asDatetimeString,
  currentDatetimeString,
  ifDatetimeString,
  isDatetimeString,
  toDatetimeString,
} from '@atproto/lex'

currentDatetimeString() // now
toDatetimeString(date) // throws InvalidDatetimeError on an out-of-range date
asDatetimeString(str) // validates + brands a string, throws on invalid
isDatetimeString(value) // type guard
ifDatetimeString(value) // DatetimeString | undefined
```

`isDatetimeStringLenient` accepts ISO-ish strings that the spec rejects (e.g.
missing a timezone) — use it when reading legacy records, not when writing.
For repairing bad historical `createdAt` values, `normalizeDatetime` /
`normalizeDatetimeAlways` live in `@atproto/syntax` only; they are not
re-exported from `@atproto/lex`.

Use `DatetimeString` on record and DB row types so a raw `string` can't drift
in:

```ts
import type { DatetimeString, DidString } from '@atproto/lex'

interface Row {
  did: DidString
  indexedAt: DatetimeString
}
```

## Identifier strings

Nominal string types keep unvalidated `string`s from being passed where a
validated identifier is expected.

| Type                 | Format                     | Guard                  |
| -------------------- | -------------------------- | ---------------------- |
| `DidString`          | `did:method:specific-id`   | `isDidString`          |
| `HandleString`       | DNS-style handle           | `isHandleString`       |
| `AtIdentifierString` | DID **or** handle          | `isAtIdentifierString` |
| `AtUriString`        | `at://…`                   | `isAtUriString`        |
| `UriString`          | any `scheme:…` URI         | `isUriString`          |
| `NsidString`         | `app.bsky.feed.post`       | `isNsidString`         |
| `TidString`          | timestamp identifier       | `isTidString`          |
| `RecordKeyString`    | rkey (TID or literal)      | `isRecordKeyString`    |
| `CidString`          | CID in string form         | `isCidString`          |
| `LanguageString`     | BCP-47 tag (`en`, `pt-BR`) | `isLanguageString`     |
| `DatetimeString`     | AT Proto datetime          | `isDatetimeString`     |

Only `AtUriString`, `AtIdentifierString` and `DatetimeString` also ship
`as…` / `assert…` / `if…` variants. For the rest, the generic format helpers
cover the same ground:

```ts
import { asStringFormat, ifStringFormat, isStringFormat } from '@atproto/lex'

isStringFormat(value, 'did') // narrows to DidString
asStringFormat(value, 'nsid') // throws TypeError on invalid
ifStringFormat(value, 'handle') // HandleString | undefined
```

`isAtUriString`, `isLanguageString` and `isStringFormat` accept
`{ strict: false }` for a lenient pass that tolerates non-conforming
real-world data.

> [!NOTE]
> These types are defined in `@atproto/syntax` and re-exported through
> `@atproto/lex`. Import from `@atproto/lex` where the package already depends
> on it — that keeps identifier types and generated schemas coming from one
> place and avoids adding a `@atproto/syntax` dependency.

### Boundaries

Protobuf messages, data-plane responses and Kysely rows all arrive as bare
`string`. Brand them once at the boundary so downstream code is typed, instead
of asserting at each use:

```ts
dids: dids as DidString[],
post: { uri: item.uri as AtUriString, cid: item.cid || undefined },
```

An `as` cast is appropriate where the value provably came from a validated
source (your own DB, a schema-validated response). Where it did not — env
vars, CLI args, user input — run the guard: `assert(isDidString(serverDid))`.

## Blob references

Two shapes coexist on the network:

```ts
type TypedBlobRef = { $type: 'blob'; ref: Cid; mimeType: string; size: number }
type LegacyBlobRef = { cid: string; mimeType: string } // no $type, no size
type BlobRef = TypedBlobRef | LegacyBlobRef
```

New uploads are always `TypedBlobRef` — the PDS `uploadBlob` endpoint returns
one. Reading code has to tolerate both, which is what the format-agnostic
accessors are for:

```ts
import {
  type BlobRef,
  enumBlobRefs,
  getBlobCid,
  getBlobCidString,
  getBlobMime,
  getBlobSize,
  isLegacyBlobRef,
  isTypedBlobRef,
} from '@atproto/lex'

getBlobCid(blob) // Cid — parses the string for legacy refs, so it can throw
getBlobCidString(blob) // string — skips the parse, prefer it when you only need the string
getBlobMime(blob) // string
getBlobSize(blob) // number | undefined — legacy refs carry no size

// Deep-walk a record for its blobs (what the PDS does on record write/import)
for (const ref of enumBlobRefs(record, { allowLegacy: true, strict: false })) {
  /* … */
}
```

`enumBlobRefs` skips legacy refs unless `allowLegacy: true`.

`BlobRef` is an interface, so `instanceof` does not apply — use `isBlobRef` /
`isTypedBlobRef` / `isLegacyBlobRef`.

### What `strict` means for blobs

The word means different things at two layers, and conflating them causes
confusing validation failures:

- On the **guards** (`isBlobRef`, `isTypedBlobRef`, `isLegacyBlobRef`,
  `enumBlobRefs`), `strict` constrains the _CID flavor_. Default `true`
  requires a raw v1 sha256 CID; `strict: false` accepts any CID (and tolerates
  `size: -1`). It does not reject the legacy shape — `isBlobRef` accepts legacy
  refs either way.
- On **schema validation** (`l.blob()`), `strict: true` (the default) rejects
  legacy refs outright and enforces `accept` / `maxSize`; `strict: false`
  admits them and skips those checks.

A `Client` constructed with `strictResponseProcessing: false` threads
`strict: false` through both response parsing and schema validation, which is
how you read a server that still emits legacy refs.

## String lengths

Lexicon string constraints are measured in graphemes (user-perceived
characters) or UTF-8 bytes, never in JS string length:

```ts
import { graphemeLen, utf8Len } from '@atproto/lex'

graphemeLen('👨‍👩‍👧‍👦') // 1
utf8Len('👨‍👩‍👧‍👦') // 25
```

## Comparison

`lexEquals(a, b)` deep-compares two `LexValue`s, handling `Cid` and
`Uint8Array` where `===` and `JSON.stringify` would not.

## Related skills

- [lex-schema](../lex-schema/SKILL.md) — validating these values against
  Lexicon schemas.
- [lex-setup](../lex-setup/SKILL.md) — adding `@atproto/lex-cbor` and the rest
  of the package family to a package.
- [lexification-client](../lexification-client/SKILL.md) — migrating off
  `multiformats` `CID`, the `BlobRef` class from `@atproto/lexicon`, and
  `jsonStringToLex` / `stringifyLex`.
