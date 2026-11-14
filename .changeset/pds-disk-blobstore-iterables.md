---
"@atproto/pds": patch
---

`DiskBlobStore.putTemp()` and `putPermanent()` accept any iterable or async iterable of `Uint8Array` chunks, following `@atproto/repo`'s isomorphic `BlobStore` interface.
