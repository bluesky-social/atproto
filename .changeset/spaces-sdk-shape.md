---
'@atproto/syntax': minor
'@atproto/oauth-scopes': minor
'@atproto/oauth-provider': patch
'@atproto/oauth-provider-ui': patch
'@atproto/lex-schema': minor
'@atproto/lex-document': minor
'@atproto/lex-builder': patch
'@atproto/lexicon': minor
'@atproto/dev-env': patch
'@atproto/space': minor
'@atproto/pds': patch
---

Make the permissioned spaces SDK consistent with itself and with its sibling packages.

- `@atproto/syntax`: `SpaceRef#recordUri(authorDid, collection, rkey)` replaces `AtUri.makeSpace`. The record author in `SpaceAtUriParts` is `authorDid`. `isSpaceAtUriString` narrows to the new `SpaceAtUriString` type, and `isSpaceUri` is no longer exported.
- `@atproto/oauth-scopes`: `SpacePermission#type` and its named scope parameter are renamed `spaceType` (`space?spaceType=…`). The positional form `space:<nsid>` is unchanged. `allowsSpace` and `assertSpace` take the space (a space ref string, an object with `spaceDid`, `spaceType` and `skey`, or a match reference that may hold wildcards) and the operation as separate arguments, and `assertSpaceRef` is removed. `LexiconSpace` uses `title` and `title:lang`.
- `@atproto/lex-schema`, `@atproto/lex-document`, `@atproto/lex-builder`, `@atproto/lexicon`: a space definition is displayed by its `title` (with `title:lang`), in place of `name`. `l.space(key, nsid, collections, { title })` takes its key first, as `l.record` does, and validates it. In `@atproto/lex-schema`, `asLexiconRecordKey` returns the type of the value it is given (`T & LexiconRecordKey`), as `isLexiconRecordKey` narrows to it.
- `@atproto/space`:
  - Errors extend `SpaceError` and carry a `code`. `RepoVerificationError` is renamed `SpaceRepoVerificationError`, and an invalid KEM key throws `SpaceKemError`.
  - `verifyCommit`, `verifyRecord`, `verifyCommitMac` and `verifyRecordMac` throw on failure rather than returning a boolean.
  - Renames: `Commit` to `SpaceCommit`, `VerifiedRepo` to `VerifiedSpaceRepo`, `VerifyRepoParams` to `VerifySpaceRepoParams`, `RecordPath` to `RecordPathString`, `serializeRepo` to `writeRepoStar`, and `serializeSpaceMeta` to `writeSpaceMetaStar`.
  - A space meta archive's writer entries hold `repoRev` rather than `rev`, as `listWriters` reports it.
  - `createSpaceToken` is split into `createDelegationToken`, `createSpaceCredential` and `createClientAttestation`, each taking one options object. The token types are exported as `DELEGATION_TOKEN_TYP`, `SPACE_CREDENTIAL_TYP` and `CLIENT_ATTESTATION_TYP`. `createSpaceSig` and `createSpaceSigHeaders` take the keypair in their options, and `createSpaceSigHeaders` returns `{ headers }`.
  - `parseMacHeader` accepts `null`, and `parseWantMacHeader` requires the key share to be a DID.
  - A commit's `rev` must be a TID, as in `com.atproto.space.defs#commit`. Schemas are defined with `@atproto/lex-schema` rather than zod.
  - `formatSetHashElement`, `LTHASH_STATE_BYTES`, `REPO_STAR_TYPE`, `SPACE_META_STAR_TYPE` and `SPACE_TOKEN_TYPES` are no longer exported.
- `@atproto/pds`: a caller acting on a space it is not the authority of is refused with "Not the space authority".
- `@atproto/dev-env`: the test PLC serves DID documents with `Multikey` verification methods, as plc.directory does.
