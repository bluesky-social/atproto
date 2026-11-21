---
'@atproto/bsky': patch
---

`/blob-source` now returns 404 for the blobs of an account its PDS has taken down or deactivated (the appview's `upstreamStatus`) or that no longer exists, so a caller that reads the blob from the PDS's object storage instead of asking the PDS gets the answer `/blob` gives, where the PDS's `getBlob` refuses that account. The appview's own takedown and its tombstone are not the PDS's state, and `/blob` ignores them too, so they are not tested.
