---
'@atproto/lex-data': minor
---

`asUint8Array` now always return an `Uint8Array`, converting `Buffer` (in Node.JS), and throwing an error if the input cannot be converted into a `Uint8Array`
