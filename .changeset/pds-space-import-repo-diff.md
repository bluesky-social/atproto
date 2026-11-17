---
"@atproto/pds": minor
---

`com.atproto.space.importRepo` commits only the difference from what the host holds, like `com.atproto.repo.importRepo`: unchanged records are left alone, the blobs of removed records are released, and the changes are recorded in the repo's op log. It now requires full access to the space (`read`, plus `create`, `update` and `delete` on every collection) rather than `create` on the collections in the archive.
