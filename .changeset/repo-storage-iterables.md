---
'@atproto/repo': minor
---

**Breaking**: `RepoStorage.getBlocks()` (and `ReadableBlockstore.getBlocks()`) receives an `Iterable<Cid>`, such as a `CidSet`, instead of a `Cid[]`, so custom storage implementations must not assume an array.
