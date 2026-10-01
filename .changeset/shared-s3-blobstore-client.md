---
'@atproto/aws': patch
---

Share one S3 client across the blob stores returned by `S3BlobStore.creator()` so that connections to S3 are reused instead of opening a new one for every blob request, and add a `maxSockets` option (uncapped by default).
