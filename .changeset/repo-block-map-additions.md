---
'@atproto/repo': patch
---

Add `BlockMap#addBlocks()` and `addEntries()`, which add `CarBlock`s and `[cid, bytes]` entries, and `BlockMap.from()`, which builds a map from a sync or async iterable of `CarBlock`s.
