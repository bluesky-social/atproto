---
'@atproto/repo': patch
---

`CidSet` keeps the CID instances that were added, and iterating it yields them instead of re-parsing each CID from a string.
