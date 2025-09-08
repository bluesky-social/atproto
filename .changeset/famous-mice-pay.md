---
"@atproto/aws": patch
---

`S3BlobStore`'s `deleteMany` now supports any number of input (and will process deletes by chunks internally)
