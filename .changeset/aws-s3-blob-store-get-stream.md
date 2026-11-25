---
'@atproto/aws': minor
---

**Breaking**: `S3BlobStore#getStream()` is typed as returning an `AsyncIterable<Uint8Array>`, as `@atproto/repo`'s `BlobStore` interface now requires, rather than a Node.js `Readable` (it still is one at runtime).
