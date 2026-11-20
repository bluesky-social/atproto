---
'@atproto/sync': patch
---

An account event whose `status` is an empty string is dropped, like one with any other unknown status, instead of being emitted.
