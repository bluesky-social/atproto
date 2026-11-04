---
"@atproto/space": minor
"@atproto/pds": minor
"@atproto/api": minor
---

Settle the names and shapes of the space lexicons.

Methods are renamed: `com.atproto.space.listRepos` to `listWriters` (each entry's `did` is now `repo`), `notifyWrite` to `notifyRepoUpdate`, and `notifyCredentialRevoked` to `notifyCredentialsRevoked`. `com.atproto.space.notifySpaceDeleted` is replaced by `notifySpaceStatus`, which carries a `status` of `deleted`.

`com.atproto.memberspace.putMember` and `removeMember` are replaced by `putMembers` and `removeMembers`, which take up to 100 members (or DIDs) and apply them in a single commit. A DID listed twice in `putMembers` takes its last entry, and `removeMembers` ignores DIDs that are not members, leaving them in the writer set. The member object moves to `com.atproto.memberspace.defs#member`.

`com.atproto.managedspace.checkUserAccess` is replaced by `checkAccess`, which takes an optional `repo` (in place of `user`) and no `access`, and answers both `read` and `write`. Without a delegation token, a managed space now asks its managing app, with no `repo`, rather than refusing outright. `managingApp` must be a `did#serviceId` reference.

`registerNotify` requires a `did#serviceId` reference. `unregisterNotify` also accepts a bare DID, which withdraws every registration under that DID.

Fields are renamed: `createSpace` and `getSpace` return `space` in place of `uri`, `getSpaceCredential` takes `credentialKey` in place of `credentialKid`, `removeWriter` takes `repo` in place of `did`, and `listSpaces` filters by `spaceDid` in place of `did`. `listSpaces` returns `space` in place of `uri`, along with the `repoRev` and `data` of the caller's repo in the space, and the space's latest `spaceRev` when the caller is its authority.

`listBlobs` drops its `since` parameter and `listRecords` drops `reverse`. `getRepo`, `exportSpaceMeta`, `importRepo`, and `importSpaceMeta` use the `application/vnd.dasl.star` encoding.

Errors are renamed: `NotSpaceOwner` to `NotAuthorized`, `BadSpaceMac` to `InvalidSpaceMac` (also the `code` of `SpaceMacError`), and `UserNotAuthorized` to `AccountNotAuthorized`. `importRepo` reports a malformed archive as `InvalidRepoFile` and another account's repo as `RepoMismatch`, and `importSpaceMeta` reports a malformed archive as `InvalidSpaceMeta`. `listRepoOps` reports a malformed cursor as `InvalidCursor` in place of `MalformedCursor`. `getSpace` and `listMembers` declare `NotAuthorized`, which they already returned to a caller other than the space authority.
