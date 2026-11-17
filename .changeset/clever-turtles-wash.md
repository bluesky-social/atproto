---
"@atproto/lex-cbor": patch
"@atproto/lex": patch
---

Remove the `encodeOptions` and `decodeOptions` exports. They were internal cborg configuration, not meant to be public; use `encode`, `decode` and `decodeAll` instead.
