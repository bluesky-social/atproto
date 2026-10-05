---
"@atproto/pds": patch
---

Redirect S3-backed `getBlob` requests to short-lived presigned download URLs after checking account and blob availability. Continue streaming disk-backed blobs directly.
