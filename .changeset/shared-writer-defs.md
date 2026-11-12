---
"@atproto/pds": minor
"@atproto/lex-space": patch
---

`com.atproto.space.listWriters` and `notifySpaceUpdate` share `com.atproto.space.defs#repoWrite` (`{ repo, repoRev, data, spaceRev, prevSpaceRev? }`) and `#repoRemoved` (`{ repo, spaceRev, prevSpaceRev? }`). Each listWriters entry is now one of these, in place of `{ repo, latest, spaceRev }`, and the `$type` of a notifySpaceUpdate `update` for a repo is `com.atproto.space.defs#repoWrite` or `#repoRemoved`.

`@atproto/lex-space`:
- `notifyRegistrationProvider` registers for notifications of updates to a space with each credential.
- `SpaceCredential#spaceRev` is the space's revision when the credential was issued.
- `writers()` yields `repoWrite` and `repoRemoved` entries, and `allRecords()` skips removed writers.
- `pullRepo()` pulls a repo its host does not have as `{ type: 'empty' }`.
- Renewing a credential re-resolves the space authority, and a member's DID document missing its KEM key is resolved again.
