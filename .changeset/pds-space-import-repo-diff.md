---
"@atproto/pds": minor
---

`com.atproto.space.importRepo` indexes only the difference from what the host holds, like `com.atproto.repo.importRepo`: unchanged records are left alone and the blobs of removed records are released. As before, the repo's op log is cleared and the repo reset to a new rev. It now requires full access to the space (`read`, plus `create`, `update` and `delete` on every collection) rather than `create` on the collections in the archive.
