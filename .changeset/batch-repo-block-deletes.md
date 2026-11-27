---
'@atproto/pds': patch
---

`com.atproto.repo.importRepo` no longer fails with "too many SQL variables" when it replaces a large repo. The blocks it removes are now deleted in batches.
