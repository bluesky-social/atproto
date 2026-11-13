---
'@atproto/syntax': patch
---

`RecordKeyString` is now `string & {}`, so a union with string literals (e.g. `'*' | RecordKeyString`) keeps its literal members.
