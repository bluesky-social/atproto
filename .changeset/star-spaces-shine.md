---
"@atproto/space": minor
"@atproto/pds": minor
"@atproto/api": minor
"@atproto/car": patch
---

Serialize space repos as STAR-lite v1 archives (`atproto-space-repo` profile) instead of CAR files. `com.atproto.space.getRepo` now returns a STAR archive whose metadata carries the repo's `did`, the `space`, and the signed commit, followed by one path/record pair per record in strict path order. Its `excludeValues` parameter is removed, as the archive no longer has a separate index.

`serializeRepo` takes the space and author alongside the commit, and `verifyRepoCar`/`verifyRepoCarFull` are replaced by `verifyRepoStar`/`verifyRepoStarFull`, which check the archive's `did` and `space`, reject out-of-order records, and authenticate the records against the commit's hash once the archive is fully read. Records over `MAX_RECORD_SIZE` (1 MiB) are rejected before they're read, and the PDS refuses to write a space record over that size. `RepoIndex` and `RepoCommit.fromIndex` are removed.

`@atproto/car` exports `createBytesReader`, `BytesReader`, and `encodeVarInt`, for other varint-framed formats.
