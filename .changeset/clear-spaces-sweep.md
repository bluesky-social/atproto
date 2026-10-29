---
"@atproto/pds": patch
"@atproto/api": patch
---

Add `com.atproto.space.clearRecords`, which deletes every record in the caller's repo in a space. The repo advances to a new revision with the empty repo's digest, its oplog is cleared, and the space host is sent a write notification. Clearing requires a `delete` grant for every collection the repo holds records in. Clearing an empty or never-written repo is a no-op.
