---
'@atproto/bsky': patch
---

Forward the request's validated `x-real-ip` address to the data plane as Connect call headers on all unauthenticated requests. Missing, duplicated, or malformed values are omitted.
