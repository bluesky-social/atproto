---
'@atproto/lex-schema': patch
---

Type the `encoding` field of `Payload` more accurately. Methods with an encoding of `*/*` are now correctly represented as `${string}/${string}` instead of the `*/*` literal type.

