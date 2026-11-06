---
"@atproto/pds": patch
---

Look up accounts by handle and email through the existing `lower()` indexes instead of scanning the account db, and move blobs to permanent storage before taking the actor db write lock in `createRecord`, `putRecord` and `applyWrites`. `DiskBlobStore.makePermanent()` now writes the stored blob atomically. The sequencer and sequencer-recovery dbs now apply `wal_autocheckpoint = 0` when `disableWalAutoCheckpoint` is set.
