---
name: data-model
description: >
  AT Protocol data model types: LexValue, LexMap, LexScalar, TypedLexMap.
  Cid content identifiers: parseCid, ifCid, isCid. BlobRef: isBlobRef,
  isLegacyBlobRef. JSON encoding: lexParse, lexStringify, jsonToLex, lexToJson.
  CBOR: encode/decode from @atproto/lex-cbor. DatetimeString: toDatetimeString,
  asDatetimeString, currentDatetimeString. graphemeLen, utf8Len. lexEquals.
type: core
library: '@atproto/lex'
library_version: '0.0.20'
sources:
  - 'bluesky-social/atproto:packages/lex/lex/README.md'
  - 'bluesky-social/atproto:packages/lex/lex-data/src/cid.ts'
  - 'bluesky-social/atproto:packages/lex/lex-data/src/blob.ts'
  - 'bluesky-social/atproto:packages/lex/lex-json/src/lex-json.ts'
---

# data-model

AT Protocol data model primitives: types, CIDs, blobs, JSON encoding, datetime strings, and string measurement.

## Setup

All data model exports are available from the top-level `@atproto/lex` package. The sub-packages (`@atproto/lex-data`, `@atproto/lex-json`) are re-exported through it.

```typescript
import {
  // Types
  type LexValue,
  type LexMap,
  type LexScalar,
  type LexArray,
  type TypedLexMap,

  // Type guards
  isLexValue,
  isLexMap,
  isLexScalar,
  isLexArray,
  isTypedLexMap,

  // CID
  type Cid,
  parseCid,
  parseCidSafe,
  isCid,
  ifCid,
  asCid,
  decodeCid,
  validateCidString,
  cidForCbor,
  cidForRawBytes,

  // Blob
  type BlobRef,
  type LegacyBlobRef,
  isBlobRef,
  isLegacyBlobRef,
  enumBlobRefs,

  // JSON encoding/decoding
  lexParse,
  lexStringify,
  jsonToLex,
  lexToJson,

  // Equality
  lexEquals,

  // Datetime
  type DatetimeString,
  toDatetimeString,
  asDatetimeString,
  currentDatetimeString,
  isDatetimeString,
  ifDatetimeString,

  // String measurement
  graphemeLen,
  utf8Len,
} from '@atproto/lex'
```

### LexValue type hierarchy

```
LexValue = LexScalar | LexValue[] | { [key: string]?: LexValue }

LexScalar = number | string | boolean | null | Cid | Uint8Array

LexMap   = { [key: string]?: LexValue }     // plain object
TypedLexMap = LexMap & { $type: string }     // object with $type discriminator
```

Numbers must be safe integers (`Number.isSafeInteger`). Floats are not valid in the Lex data model.

## Core Patterns

### 1. JSON encoding and decoding

The AT Protocol data model has types (Cid, Uint8Array) that standard JSON cannot represent. Use `lexParse`/`lexStringify` to round-trip them correctly.

```typescript
import { lexParse, lexStringify, jsonToLex, lexToJson } from '@atproto/lex'
import type { Cid, LexValue } from '@atproto/lex'

// --- Parsing JSON with AT Protocol types ---

// lexParse: JSON string -> LexValue (decodes $link -> Cid, $bytes -> Uint8Array)
const record = lexParse<{
  text: string
  ref: Cid
  data: Uint8Array
}>(`{
  "text": "hello",
  "ref": {"$link": "bafyreib2rxk3rybcsrdalacpqm3x7bcnqm6unsm7vlqngokyycmygks7oi"},
  "data": {"$bytes": "SGVsbG8="}
}`)
// record.ref is a Cid instance (not a plain object)
// record.data is a Uint8Array (not a plain object)

// lexStringify: LexValue -> JSON string (encodes Cid -> $link, Uint8Array -> $bytes)
const json = lexStringify(record)
// '{"text":"hello","ref":{"$link":"bafyreib2rx..."},"data":{"$bytes":"SGVsbG8="}}'

// --- Working with already-parsed objects ---

// jsonToLex: parsed JSON object -> LexValue (for data from JSON.parse or HTTP)
const fromApi = { ref: { $link: 'bafyreib2rxk3rybcsrdalacpqm3x7bcnqm6unsm7vlqngokyycmygks7oi' } }
const lexData = jsonToLex(fromApi)
// lexData.ref is now a Cid instance

// lexToJson: LexValue -> plain JSON object (for custom serialization)
const plainObj = lexToJson(record)
// plainObj.ref is { $link: 'bafyreib2rx...' }

// --- Strict mode catches malformed data ---
const strict = lexParse('{"val": 3.14}', { strict: true })
// Throws TypeError: "Invalid non-integer number: 3.14"
```

### 2. Working with CIDs

CIDs (Content Identifiers) address content by cryptographic hash. AT Protocol uses CIDv1.

```typescript
import {
  parseCid,
  parseCidSafe,
  isCid,
  ifCid,
  asCid,
  validateCidString,
  cidForCbor,
  cidForRawBytes,
  lexEquals,
} from '@atproto/lex'
import type { Cid, CborCid, RawCid } from '@atproto/lex'

// Parse a CID from string (throws on invalid input)
const cid: Cid = parseCid('bafyreib2rxk3rybcsrdalacpqm3x7bcnqm6unsm7vlqngokyycmygks7oi')

// Safe parse (returns null instead of throwing)
const maybeCid = parseCidSafe('not-a-cid')  // null

// Type guard
if (isCid(someValue)) {
  console.log(someValue.toString())  // base32 string
  console.log(someValue.version)     // 1 for CIDv1
  console.log(someValue.code)        // multicodec (0x71 = dag-cbor, 0x55 = raw)
}

// Conditional extraction (returns value as Cid or null)
const extracted = ifCid(someValue)

// Validate a string is a canonical CID representation
const isValid = validateCidString('bafyreib2rxk3rybcsrdalacpqm3x7bcnqm6unsm7vlqngokyycmygks7oi')  // true

// Flavor-constrained parsing
const cborCid = parseCid(cidStr, { flavor: 'cbor' })   // CborCid (dag-cbor, sha256)
const rawCid = parseCid(cidStr, { flavor: 'raw' })     // RawCid (raw binary, any hash)
const daslCid = parseCid(cidStr, { flavor: 'dasl' })   // DaslCid (v1, raw|cbor, sha256)

// Create CIDs from bytes
const dataCid: CborCid = await cidForCbor(cborEncodedBytes)
const blobCid: RawCid = await cidForRawBytes(rawBinaryData)

// Compare CIDs correctly (see Common Mistakes #5)
const areEqual: boolean = cid.equals(otherCid)
// Or use lexEquals for deep comparison of any LexValue
const deepEqual: boolean = lexEquals(cid, otherCid)
```

### 3. DatetimeString utilities

AT Protocol timestamps must be ISO 8601 datetime strings with specific formatting rules.

```typescript
import {
  currentDatetimeString,
  toDatetimeString,
  asDatetimeString,
  isDatetimeString,
  ifDatetimeString,
} from '@atproto/lex'
import type { DatetimeString } from '@atproto/lex'

// Get current time as a valid AT Protocol datetime
const now: DatetimeString = currentDatetimeString()
// e.g. '2026-03-09T14:30:00.000Z'

// Convert a Date to DatetimeString
const dt: DatetimeString = toDatetimeString(new Date('2024-01-15T12:00:00Z'))

// Validate and narrow a string
if (isDatetimeString(input)) {
  // input is DatetimeString
}

// Assert (throws if invalid)
const validated: DatetimeString = asDatetimeString('2024-01-15T12:00:00.000Z')

// Conditional (returns null if invalid)
const maybe = ifDatetimeString('not-a-date')  // null
```

### 4. String length measurement

Lexicon string constraints use grapheme length, not JavaScript string length.

```typescript
import { graphemeLen, utf8Len } from '@atproto/lex'

// graphemeLen counts user-perceived characters (Unicode grapheme clusters)
graphemeLen('hello')           // 5
graphemeLen('cafe\u0301')      // 4  (e + combining accent = 1 grapheme)
graphemeLen('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}')  // 1  (family emoji)

// utf8Len counts UTF-8 byte length
utf8Len('hello')               // 5   (ASCII: 1 byte each)
utf8Len('\u00e9')              // 2   (e-acute: 2 bytes)
utf8Len('\u{1F600}')           // 4   (grinning face: 4 bytes)

// Use graphemeLen for Lexicon maxGraphemes constraints
function validatePostText(text: string): boolean {
  return graphemeLen(text) <= 300
}

// Use utf8Len for Lexicon maxLength (byte length) constraints
function validateLabel(value: string): boolean {
  return utf8Len(value) <= 128
}
```

## Common Mistakes

### 1. CRITICAL: Using JSON.parse instead of lexParse

Standard `JSON.parse` does not convert `$link` to Cid or `$bytes` to Uint8Array. Data stays as plain objects, failing type guards like `isCid`.

```typescript
// WRONG: $link remains a plain object, isCid returns false
const data = JSON.parse('{"ref":{"$link":"bafyrei..."}}')
isCid(data.ref)  // false -- data.ref is { $link: 'bafyrei...' }

// CORRECT: $link is decoded to a Cid instance
const data = lexParse('{"ref":{"$link":"bafyrei..."}}')
isCid(data.ref)  // true -- data.ref is a proper Cid

// CORRECT: For already-parsed objects, use jsonToLex
const fromApi = JSON.parse(responseBody)
const lexData = jsonToLex(fromApi)
isCid(lexData.ref)  // true
```

### 2. CRITICAL: Using string length instead of graphemeLen

Lexicon constraints use grapheme length. JavaScript `str.length` counts UTF-16 code units. A family emoji is 11 code units but 1 grapheme.

```typescript
import { graphemeLen } from '@atproto/lex'

const text = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}'  // family emoji

// WRONG: counts UTF-16 code units
text.length  // 11

// CORRECT: counts grapheme clusters (what users perceive as characters)
graphemeLen(text)  // 1

// WRONG
if (text.length > 300) { /* post too long */ }

// CORRECT
if (graphemeLen(text) > 300) { /* post too long */ }
```

Also relevant in the data-validation skill.

### 3. HIGH: Constructing BlobRef without proper structure

A BlobRef must have exactly `$type: 'blob'`, `ref` (a Cid instance), `mimeType` (string containing '/'), and `size` (non-negative safe integer). Extra or missing properties cause `isBlobRef` to return false.

```typescript
import { isBlobRef, parseCid } from '@atproto/lex'
import type { BlobRef } from '@atproto/lex'

// WRONG: missing $type, ref is a string not a Cid
const bad = { ref: 'bafyrei...', mimeType: 'image/png', size: 123 }
isBlobRef(bad)  // false

// WRONG: has extra property
const alsoWrong = {
  $type: 'blob',
  ref: parseCid('bafyrei...'),
  mimeType: 'image/png',
  size: 123,
  extra: true,  // isBlobRef rejects extra properties
}
isBlobRef(alsoWrong)  // false

// CORRECT
const good: BlobRef = {
  $type: 'blob',
  ref: parseCid('bafyreib2rxk3rybcsrdalacpqm3x7bcnqm6unsm7vlqngokyycmygks7oi', { flavor: 'raw' }),
  mimeType: 'image/png',
  size: 123,
}
isBlobRef(good)  // true
```

### 4. MEDIUM: Not handling legacy blob refs in old records

Pre-2023 records use the legacy format `{ cid: string, mimeType: string }` without `$type`. Use `enumBlobRefs` with `allowLegacy: true` when processing historical data.

```typescript
import { enumBlobRefs, isLegacyBlobRef, isBlobRef } from '@atproto/lex'
import type { LexValue } from '@atproto/lex'

function extractAllBlobs(record: LexValue) {
  // Finds both modern BlobRef and legacy formats
  for (const blob of enumBlobRefs(record, { allowLegacy: true })) {
    if (isBlobRef(blob)) {
      console.log('Modern blob:', blob.ref.toString(), blob.size)
    } else if (isLegacyBlobRef(blob)) {
      console.log('Legacy blob:', blob.cid, blob.mimeType)
    }
  }
}
```

### 5. HIGH: Comparing CIDs with === instead of .equals()

CID instances are objects. The `===` operator compares references, not values. Two CIDs with identical content will be `!==` if they are different object instances.

```typescript
import { parseCid, lexEquals } from '@atproto/lex'

const cid1 = parseCid('bafyreib2rxk3rybcsrdalacpqm3x7bcnqm6unsm7vlqngokyycmygks7oi')
const cid2 = parseCid('bafyreib2rxk3rybcsrdalacpqm3x7bcnqm6unsm7vlqngokyycmygks7oi')

// WRONG: compares object references
cid1 === cid2  // false (different instances)

// CORRECT: compares CID content
cid1.equals(cid2)  // true

// CORRECT: lexEquals handles CIDs (and all other LexValue types)
lexEquals(cid1, cid2)  // true

// For collections, use lexEquals for deep comparison including nested CIDs
const record1 = { ref: cid1, tags: ['a'] }
const record2 = { ref: cid2, tags: ['a'] }
lexEquals(record1, record2)  // true
```

### 6. CRITICAL (cross-skill): Using new Date().toISOString() for createdAt

The `new Date().toISOString()` output is valid ISO 8601, but AT Protocol has specific datetime formatting requirements enforced by schema validation. Use `currentDatetimeString()` instead.

```typescript
import { currentDatetimeString, toDatetimeString } from '@atproto/lex'

// WRONG: may not meet AT Protocol datetime format requirements
const createdAt = new Date().toISOString()

// CORRECT: produces a properly formatted AT Protocol datetime
const createdAt = currentDatetimeString()

// CORRECT: convert an existing Date
const createdAt = toDatetimeString(someDate)
```

See also: client-api skill for record creation patterns.

## See also

- **data-validation**: Schema validation of LexValues against Lexicon definitions, including graphemeLen constraints.
- **client-api**: Record creation, blob upload, and XRPC request patterns that consume data model types.
- **lexicon-management**: Defining schemas that constrain data model types (maxGraphemes, string formats, etc.).
