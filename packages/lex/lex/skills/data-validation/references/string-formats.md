# String Formats and Utilities

`l.string()` accepts a `format` option that applies AT Protocol-specific validation.
There are 11 supported formats, plus utility functions for string measurement and
datetime handling.

## String Formats

### at-identifier

Validates an AT Protocol identifier -- either a handle or a DID.

```ts
const schema = l.string({ format: 'at-identifier' })
```

- Valid: `"alice.bsky.social"`, `"did:plc:z72i7hdynmk6r22z27h6tvur"`
- Invalid: `""`, `"@alice"`, `"did:"`, `"not a valid id"`

### at-uri

Validates an AT Protocol URI.

```ts
const schema = l.string({ format: 'at-uri' })
```

- Valid: `"at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3jt7rr2hsg2"`, `"at://alice.bsky.social/app.bsky.feed.like/123"`
- Invalid: `"https://bsky.app"`, `"at://"`, `"at://did:plc:abc"` (missing collection)

### cid

Validates a Content Identifier string (CIDv1, base32-lower multibase).

```ts
const schema = l.string({ format: 'cid' })
```

- Valid: `"bafyreig6fjriecvdzczltp5nf5doyac3a7rar35bmaagxkvpknb3ab5moe"`
- Invalid: `""`, `"not-a-cid"`, `"QmOldCidV0format"`

### datetime

Validates an AT Protocol datetime (a strict subset of ISO 8601). Years must be in the
range 0010-9999 and a timezone designator is required.

```ts
const schema = l.string({ format: 'datetime' })
```

- Valid: `"2024-11-15T12:00:00Z"`, `"2024-11-15T12:00:00.123Z"`, `"2024-11-15T14:00:00+02:00"`
- Invalid: `"2024-11-15"` (no time/timezone), `"2024-11-15T12:00:00"` (no timezone), `"0001-01-01T00:00:00Z"` (year < 10)

### did

Validates a Decentralized Identifier.

```ts
const schema = l.string({ format: 'did' })
```

- Valid: `"did:plc:z72i7hdynmk6r22z27h6tvur"`, `"did:web:example.com"`
- Invalid: `""`, `"did:"`, `"plc:z72i7hdynmk6r22z27h6tvur"`, `"did:plc:"`

### handle

Validates an AT Protocol handle.

```ts
const schema = l.string({ format: 'handle' })
```

- Valid: `"alice.bsky.social"`, `"bob.test"`, `"carol.example.com"`
- Invalid: `""`, `"alice"`, `".bsky.social"`, `"alice..bsky.social"`

### language

Validates a BCP-47 language tag.

```ts
const schema = l.string({ format: 'language' })
```

- Valid: `"en"`, `"pt-BR"`, `"zh-Hans"`, `"fr-CA"`
- Invalid: `""`, `"english"`, `"123"`, `"en_US"` (underscore not hyphen)

### nsid

Validates a Namespace Identifier.

```ts
const schema = l.string({ format: 'nsid' })
```

- Valid: `"app.bsky.feed.post"`, `"com.atproto.repo.createRecord"`
- Invalid: `""`, `"app.bsky"`, `"app"`, `"App.Bsky.Feed.Post"` (uppercase)

### record-key

Validates a record key (rkey). Typically a TID or the literal `"self"`.

```ts
const schema = l.string({ format: 'record-key' })
```

- Valid: `"3jt7rr2hsg2"`, `"self"`
- Invalid: `""`, `"."`, `".."`, `"has/slash"`

### tid

Validates a Timestamp-based Identifier (TID). A 13-character base32-sortable string.

```ts
const schema = l.string({ format: 'tid' })
```

- Valid: `"3jt7rr2hsg2ab"`
- Invalid: `""`, `"too-short"`, `"UPPERCASE1234A"`

### uri

Validates a generic URI (RFC 3986).

```ts
const schema = l.string({ format: 'uri' })
```

- Valid: `"https://example.com"`, `"mailto:alice@example.com"`, `"ftp://files.example.com/doc.txt"`
- Invalid: `""`, `"not a uri"`, `"://missing-scheme"`

## String Length Measurement

AT Protocol uses two different length measurements depending on context.

### graphemeLen(str)

Counts user-perceived characters (grapheme clusters). Use this for lexicon
`maxGraphemes` / `minGraphemes` constraints.

```ts
import { graphemeLen } from '@atproto/lex'

graphemeLen('hello')         // 5
graphemeLen('नमस्ते')          // 3
graphemeLen('👨‍👩‍👧‍👧')            // 1
graphemeLen('café')           // 4
```

### utf8Len(str)

Counts UTF-8 encoded bytes. Use this for lexicon `maxLength` / `minLength` constraints.

```ts
import { utf8Len } from '@atproto/lex'

utf8Len('hello')   // 5   (ASCII = 1 byte each)
utf8Len('ö')       // 2
utf8Len('☎')       // 3
utf8Len('😀')      // 4
utf8Len('👨‍👩‍👧‍👧')    // 25  (4 code points + 3 ZWJ, each multi-byte)
```

### isLanguageString(str)

Validates whether a string is a well-formed BCP-47 language tag. Returns a boolean.

```ts
import { isLanguageString } from '@atproto/lex'

isLanguageString('en')       // true
isLanguageString('pt-BR')    // true
isLanguageString('english')  // false
```

## Datetime Utilities

AT Protocol defines a strict datetime format (ISO 8601 subset, years 0010-9999,
timezone required). The library provides a branded `DatetimeString` type and several
utilities for working with it.

**Important:** `new Date().toISOString()` is NOT guaranteed to produce a valid AT
Protocol datetime. Years outside the 0010-9999 range will fail validation.

### l.toDatetimeString(date)

Converts a `Date` object to a `DatetimeString`. Throws `InvalidDatetimeError` if the
date cannot be represented as a valid AT Protocol datetime.

```ts
const dt = l.toDatetimeString(new Date())
// "2024-11-15T18:30:00.000Z" (typed as DatetimeString)

l.toDatetimeString(new Date('invalid'))
// throws InvalidDatetimeError
```

### l.asDatetimeString(input)

Casts an existing string to `DatetimeString`. Throws if the string does not conform to
the AT Protocol datetime format.

```ts
const dt = l.asDatetimeString('2024-11-15T12:00:00Z')
// DatetimeString

l.asDatetimeString('2024-11-15')
// throws InvalidDatetimeError
```

### l.isDatetimeString(input)

Type guard that returns `true` if the input is a valid `DatetimeString`.

```ts
const maybeDate: unknown = '2024-11-15T12:00:00Z'

if (l.isDatetimeString(maybeDate)) {
  // maybeDate is narrowed to DatetimeString
}
```

### l.ifDatetimeString(input)

Returns the input as `DatetimeString` if valid, or `undefined` otherwise. Useful for
optional fields.

```ts
const dt = l.ifDatetimeString('2024-11-15T12:00:00Z')
// DatetimeString

const nope = l.ifDatetimeString('not-a-date')
// undefined
```

### l.currentDatetimeString()

Returns the current time as a `DatetimeString`.

```ts
const now = l.currentDatetimeString()
// "2024-11-15T18:30:00.000Z" (typed as DatetimeString)
```

## Combining Format with Other String Options

String format validation composes with other `l.string()` options:

```ts
const postContent = l.string({
  minGraphemes: 1,
  maxGraphemes: 300,
  maxLength: 3000,
})

const postUri = l.string({
  format: 'at-uri',
  maxLength: 8192,
})

const langTag = l.string({
  format: 'language',
  maxGraphemes: 64,
})
```

Format validation runs in addition to length checks. A value must pass both to be
considered valid.
