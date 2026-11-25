---
'@atproto/aws': patch
---

`S3BlobStore#putTemp()` accepts any `Iterable` or `AsyncIterable` of `Uint8Array` chunks, and `putPermanent()` any `AsyncIterable`, besides a `Uint8Array`.
