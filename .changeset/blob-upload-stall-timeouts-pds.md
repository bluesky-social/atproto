---
'@atproto/pds': patch
---

Add `PDS_BLOBSTORE_S3_REQUEST_TIMEOUT_MS` environment variable to configure the S3 blobstore's per-request (stall detection) timeout independently from the total upload timeout. Blob upload timeouts (including stalled S3 connections) are now correctly surfaced as HTTP 504 `UpstreamTimeout` errors instead of 500s on `com.atproto.repo.uploadBlob`.
