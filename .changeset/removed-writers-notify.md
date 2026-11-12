---
"@atproto/pds": minor
"@atproto/api": minor
---

Report removals from a space's writer set to syncers.

`com.atproto.space.notifyRepoUpdate` and each `com.atproto.space.listWriters` entry replace `repoRev` and `data` with `latest`, a union of `com.atproto.space.defs#repoWrite` (carrying `rev` and `data`) and `com.atproto.space.defs#repoRemoved`. Repo hosts send only `repoWrite`, and the space host rejects a `repoRemoved` from them.

When `removeWriter`, `removeMembers`, or a `putMembers` that revokes write access removes a repo from the writer set, the space host advances the space sequence and forwards a `repoRemoved` notification to registered syncers. `listWriters` keeps listing the repo as removed until it writes again. `exportSpaceMeta` leaves removed repos out of the archive.

Under a `memberspace` policy with `publicWrite`, a member whose `write` access is false is no longer tracked as a writer.
