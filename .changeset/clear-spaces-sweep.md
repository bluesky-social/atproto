---
"@atproto/pds": patch
"@atproto/api": patch
---

Add `com.atproto.space.clearRecords`, which deletes every record in the caller's repo in a space. The repo advances to a new revision with the empty repo's digest, its oplog is cleared, and the space host is sent a write notification. In the space authority's own repo, the published `com.atproto.space.policy` and `com.atproto.memberspace.member` records are kept, since they are the PDS's copy of the space's configuration. Clearing requires a `delete` grant for every other collection the repo holds records in. Clearing a repo with nothing to delete is a no-op.
