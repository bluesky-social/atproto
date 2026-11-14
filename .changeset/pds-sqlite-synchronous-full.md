---
'@atproto/pds': patch
---

Add `PDS_SQLITE_SYNCHRONOUS_FULL`: when set, the actor store, account and sequencer SQLite databases run with `synchronous = FULL`, so an acknowledged write survives a power cut.
