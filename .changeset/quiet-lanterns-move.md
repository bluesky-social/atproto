---
"@atproto/pds": patch
---

Look up accounts by handle and email through the existing `lower()` indexes instead of scanning the account db, and move blobs to permanent storage before taking the actor db write lock in `createRecord`, `putRecord` and `applyWrites`. `DiskBlobStore.makePermanent()` now writes the stored blob atomically.
