---
'@atproto/repo': minor
---

**Breaking**: `readCarStream()` resolves to a `CarReader` (with `roots` and `blocks`) that must be disposed of, with `await using` or `destroy()`, instead of calling `blocks.dump()`. The `CarBlockIterable` type, `readCarReader()` and `verifyIncomingCarBlocks()` are removed.
