---
'@atproto/repo': minor
---

**Breaking**: `BlockMap` holds `CarBlock`s (`{ cid, bytes }`). Its constructor takes an iterable of `CarBlock` instead of `[cid, bytes]` entries, iterating it yields `CarBlock` objects instead of `[cid, bytes]` tuples, and `entries()` returns an iterator of `[cid, bytes]` tuples instead of an array of `{ cid, bytes }`.
