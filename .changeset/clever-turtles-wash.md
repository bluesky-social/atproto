---
"@atproto/lex-cbor": patch
"@atproto/lex": patch
---

Remove the `encodeOptions` and `decodeOptions` exports from `@atproto/lex-cbor`, and so from `@atproto/lex`, which re-exports it. They were internal cborg configuration, not meant to be public; use `encode`, `decode` and `decodeAll` instead.
