---
'@atproto/pds': minor
---

**Breaking**: `com.atproto.sync.getBlob` returns `BlobNotFound` for a blob that no public record references, so blobs referenced only by space records are not served publicly.
