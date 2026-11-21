---
'@atproto/bsky': patch
---

`/blob-source` now returns 404 for the blobs of an account its PDS has taken down or deactivated (the appview's `upstreamStatus`), so a caller that reads the blob from the PDS's object storage instead of asking the PDS gets the same answer `/blob` gives, where the PDS's `getBlob` refuses that account. Nothing else changes: the appview's own takedown and whether the actor is indexed are not the PDS's state, and `/blob` ignores them too.
