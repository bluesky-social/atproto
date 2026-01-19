---
'@atproto/api': patch
'@atproto/bsky': patch
---

Removes `recId` from suggested users — we need at as string, so we're gonna re-add it as string (instead of integer) later.
