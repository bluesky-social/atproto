---
'@atproto/repo': minor
---

**Breaking**: Make the `BlobStore` interface isomorphic. `putTemp()` and `putPermanent()` take a `Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>` instead of a `Uint8Array | Readable`, and `getStream()` resolves to an `AsyncIterable<Uint8Array>` instead of a Node.js `Readable`.
