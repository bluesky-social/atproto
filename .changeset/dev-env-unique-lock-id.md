---
'@atproto/dev-env': patch
---

Make `uniqueLockId` throw a `RangeError` once its 1000 lock ids are used, instead of looping forever.
