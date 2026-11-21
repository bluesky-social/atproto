---
'@atproto/bsky': patch
---

`/blob-source` now returns 404 for the blobs of an account that is taken down, deactivated, suspended, deleted or unknown to the appview, so a caller that reads the blob from the PDS's object storage instead of asking the PDS is refused as `getBlob` would refuse it. The `/blob` route is unchanged: the PDS still enforces account state there.
