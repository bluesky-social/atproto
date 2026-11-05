---
'@atproto/lex-data': patch
'@atproto/lex-cbor': patch
'@atproto/lex-schema': patch
---

Add `ui8ConcatAsync()` to `@atproto/lex-data`, type `encode()`'s result in `@atproto/lex-cbor` as `Uint8Array<ArrayBuffer>`, and keep `bytes` schemas from coercing arrays and array-like objects now that `asUint8Array` accepts them.
