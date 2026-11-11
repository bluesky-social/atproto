---
"@atproto/space": minor
"@atproto/pds": minor
"@atproto/api": patch
---

Carry space repo MACs as HTTP message signatures (RFC 9421, `hmac-sha256`). A syncer requests a MAC with `Accept-Signature`, giving its ephemeral KEM key as the `keyid` and the MAC profile (`atproto-space-repo` or `atproto-space-record`) as the `tag`. The repo host responds with an `Atproto-Space-Commit` or `Atproto-Space-Record` header describing the commit or record it returned, and a `Signature-Input` and `Signature` covering that header under the requested label. This replaces the `Atproto-Space-Want-Mac` and `Atproto-Space-Mac` headers. The PDS lists `Accept-Signature` in `Vary`, and exposes the new headers to browsers through `Access-Control-Expose-Headers`.

A host ignores requested signatures with other tags, and refuses more than one request with the profile's tag, or a request for parameters other than `keyid`, `tag` and `alg`.

Space credential signatures and MACs are verified alike: a verifier finds exactly one signature with the expected tag, whatever its label, covering exactly the expected components, with `keyid` and `alg` matching if present. Other parameters, such as `created`, are covered but otherwise ignored. Space credential signatures are made under the `sig` label.

`com.atproto.space.listRepoOps` includes the repo's current commit, and so a MAC, on every page, and answers `RepoNotFound` for a repo that has never been written. A page has a cursor whenever it is full.

In `@atproto/space`, `formatMacRequest` and `parseMacRequest` replace the MAC header helpers, and `createCommitMacHeaders` and `createRecordMacHeaders` replace `computeCommitMac` and `computeRecordMac`. `verifyCommit`, `verifyRecord`, `verifyRepoStar`, `verifyCommitMac` and `verifyRecordMac` take the MAC request's encapsulation (`keyShare` and `sharedSecret`) and the response `headers` in place of `sharedSecret` and `mac`. `COMMIT_MAC_TYPE`, `RECORD_MAC_TYPE` and `MacType` are renamed `COMMIT_MAC_PROFILE`, `RECORD_MAC_PROFILE` and `MacProfile`, and `RECORD_MAC_VERSION` is removed.
