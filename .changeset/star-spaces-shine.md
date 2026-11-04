---
"@atproto/space": minor
"@atproto/pds": minor
"@atproto/api": minor
---

Serialize space repos as STAR archives (`atproto-space-repo` profile) instead of CAR files. `com.atproto.space.getRepo` now returns a STAR archive whose metadata is the repo's commit, followed by one path/record pair per record in strict path order. Its `excludeValues` parameter is removed, as the archive no longer has a separate index.

`serializeRepo` takes the commit and the records, and `verifyRepoCar`/`verifyRepoCarFull` are replaced by `verifyRepoStar`/`verifyRepoStarFull`, which check the commit's `repo` and `space` against the request, reject out-of-order records, and check the records against the commit's `data` once the archive is fully read. The archive's metadata is limited to 64 KiB, each record path to 4 KiB, and each record to `MAX_RECORD_SIZE` (1 MiB), as `REPO_STAR_LIMITS`. An item over its limit is rejected before it's read, and the PDS refuses to write a space record over 1 MiB. `RepoIndex` and `RepoCommit.fromIndex` are removed.

Reading and writing STAR archives lives in the new `@atproto/star` package.
