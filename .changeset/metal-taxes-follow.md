---
'@atproto/pds': patch
---

Make the `com.atproto.repo.uploadBlob` rate limit configurable via `PDS_RATE_LIMIT_REPO_UPLOAD_BLOB_TIME_DURATION` and `PDS_RATE_LIMIT_REPO_UPLOAD_BLOB_POINTS` (defaults preserve the existing 1000 points / day behavior).
