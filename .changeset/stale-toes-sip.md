---
'@atproto/common': patch
'@atproto/pds': patch
---

Improve gzip streaming performance for com.atproto.sync.getRepo by coalescing small CAR chunks before compression.
