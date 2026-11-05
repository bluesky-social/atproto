---
'@atproto/lex-data': patch
---

`asUint8Array` converts Node.js `Buffer`s into plain `Uint8Array`s. Add `toUint8Array`, which throws a `TypeError` when the input cannot be converted into a `Uint8Array`.
