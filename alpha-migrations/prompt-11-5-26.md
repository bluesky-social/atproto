Bring this project's existing AT Protocol Spaces functionality up to date with the November 5, 2026 alpha release. This is a small release: one wire-format change to STAR archives, plus takedown handling that should not affect most projects. Make the smallest changes needed for compatibility. A dependency update or a verified no-op can be the complete result.

First inspect the project's instructions, dependencies/lockfile, and existing Spaces usage. Distinguish behavior this project implements itself from behavior supplied by a library, SDK, or external service. Briefly state which changes apply, with the relevant files/packages, then proceed with that scoped work.

| Existing project behavior                                                                                                                      | Work to consider                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Uses STAR only through `@atproto/space` helpers (`verifyRepoStar`, `readRepoStar`, `serializeRepo`, `serializeSpaceMeta`, `readSpaceMetaStar`) | Dependency update only.            |
| Imports `readStar`, `writeStar`, `StarParseError`, or `STAR_MAGIC` from `@atproto/space`, or varint helpers from `@atproto/car`                | Section 3.                         |
| Encodes or decodes STAR bytes itself (getRepo, importRepo, exportSpaceMeta, importSpaceMeta), in any language                                  | Section 1.                         |
| Calls getSpaceCredential or listRepos                                                                                                          | Section 2a. Usually no change.     |
| Manages spaces, or exports an account's data for migration                                                                                     | Sections 2b–2c. Usually no change. |
| Implements a space host or repo host                                                                                                           | Sections 1 and 2.                  |
| Moderation or admin tooling against the reference PDS                                                                                          | Section 2d.                        |
| Deploys, packages, or forks the reference PDS                                                                                                  | Section 4.                         |

Apply multiple rows where appropriate. If no affected functionality is present, report the evidence and stop. Preserve the project's language, architecture, and feature set, and do not add features merely because they appear below.

If the project has not yet applied the October 29 release, apply [prompt-10-29-26.md](./prompt-10-29-26.md) first (it chains to earlier releases where needed), then this prompt.

For npm consumers: the November 5 release is published as `0.0.0-spaces-alpha-20261105160032` under the `alpha` dist-tag. Use it as the compatibility target, and do not downgrade an already-compatible newer dependency. Upgrade only existing direct dependencies involved in Spaces, pinning the exact version with the project's package manager (for example `pnpm add --save-exact @atproto/space@0.0.0-spaces-alpha-20261105160032`), and let the package manager resolve transitive dependencies. `@atproto/star` is new in this release. Add it as a direct dependency only if the project imports STAR primitives itself (section 3). If a needed package can't be resolved, report that blocker rather than reimplementing it. Non-npm projects can skip this step.

Sources. Both implementation PRs are merged and published. Use the merged implementation, at [1cc3186d6c77cc71d5c316e25bf7717e4896ce60](https://github.com/bluesky-social/atproto/tree/1cc3186d6c77cc71d5c316e25bf7717e4896ce60), as the reference for exact behavior. Where proposals#134 says `listWriters`, it means `listRepos`.

- https://github.com/bluesky-social/atproto/pull/5808: STAR control bytes (sections 1, 3)
- https://github.com/bluesky-social/proposals/pull/131: STAR control bytes and archive limits
- https://github.com/bluesky-social/atproto/pull/5810: takedown handling (section 2)
- https://github.com/bluesky-social/proposals/pull/134: takedown handling
- https://dasl.ing/star.html: the STAR spec, now published by DASL. It supersedes the STAR-lite v1 spec linked from earlier releases.
- https://tangled.org/microcosm.blue/star/tree/main/interop: language-neutral valid and invalid STAR fixtures

Changed Lexicons: `com.atproto.space.getSpaceCredential` and `com.atproto.space.listRepos` each gain the errors `RepoTakendown` and `RepoDeactivated`. Nothing else changed.

1. Frame STAR archives with control bytes.

Each key/value pair is now preceded by a `0x01` byte, and the archive ends with a single `0x00` byte:

    October 29:  [ magic | len | metadata ] [ len | key | len | value ] ...              (until EOF)
    November 5:  [ magic | len | metadata ] [ 0x01 | len | key | len | value ] ... [ 0x00 ]

- This applies to both profiles: `atproto-space-repo` (getRepo, importRepo) and `atproto-space-meta` (exportSpaceMeta, importSpaceMeta). The magic bytes, varint lengths, metadata, keys, values, key ordering, and digest checks are unchanged.
- An empty archive is now the header followed by `0x00`.
- Readers reject EOF before the end byte, any control byte other than `0x00` or `0x01`, and any bytes after the end byte. A truncated archive can now be told apart from a complete one. Otherwise, follow the DASL spec for framing and parsing.
- Both profiles now limit the metadata to 64 KiB, each key to 4 KiB, and each value to 1 MiB. Readers may reject an archive over these limits, and the reference reader does. Writers should stay within them. Only the 1 MiB repo record limit was in place before. Generic STAR sets no limits of its own.
- The old and new framings are incompatible in both directions. Do not add support for the old framing. An archive saved before this release, such as an exportSpaceMeta backup, must be re-exported from an updated host. If the reference reader reports `invalid control byte` or `unexpected end of archive` on an otherwise valid archive, the other side has most likely not upgraded yet.

2. Handle takedowns and deactivations as the public repo does.

This only changes behavior for accounts that are taken down or deactivated. It is not expected to break existing flows.

2a. Suspended spaces. If a space authority is taken down or deactivated, its host answers getSpaceCredential and listRepos with `RepoTakendown` or `RepoDeactivated` (HTTP 400). The space is suspended, not deleted. Credentials already issued stay valid until they expire, members' repos are unaffected, and the space resumes if the authority is reinstated. Do not treat these errors like `SpaceDeleted` or drop synced data because of them. Generic error handling needs no change. The space repo read methods (getRecord, listRecords, getRepo, getLatestCommit, listRepoOps, getBlob, listBlobs) already returned these errors for a taken-down or deactivated repo, and still do.

2b. Space management. createSpace, updateSpace, deleteSpace, removeWriter, putMember, and removeMember now refuse a taken-down or deactivated account with `AccountTakedown` or `AccountDeactivated` (HTTP 401), as public repo writes do.

2c. Exporting after a takedown. A taken-down account can still export its space data for migration. listSpaces, exportSpaceMeta, getRepo, listBlobs, and getBlob accept the session from `com.atproto.server.createSession` with `allowTakendown: true`, the same session `com.atproto.sync.getRepo` accepts. Migration tools that already support taken-down accounts for the public repo may extend this to spaces. This is optional.

2d. Admin. The reference PDS accepts its admin token (HTTP Basic auth) on the space repo read methods, including for taken-down repos. Individual space records can't be taken down: `com.atproto.admin.updateSubjectStatus` rejects a space record subject, and `getSubjectStatus` reports space records with `takedown: { applied: false }`. To act on space content, take down the account.

2e. Space and repo host implementers: refuse getSpaceCredential and listRepos for a taken-down or deactivated authority, with the errors above. Keep accepting write notifications and registrations for such an authority, so that its writer state stays current while the space is suspended. Apply account status checks to the management methods in 2b. Allow the export methods in 2c for a taken-down account's own session.

3. Update library calls (npm).

Apply only to symbols the project already uses.

- New package `@atproto/star`: `readStar`, `writeStar`, `StarParseError`, and the types `StarMeta`, `StarPair`, `StarReader`, and `ReadStarOptions`.
- `@atproto/space` no longer exports `readStar`, `writeStar`, `StarParseError`, `StarMeta`, `StarPair`, or `StarReader`. Import them from `@atproto/star`. `STAR_MAGIC` is no longer exported by any package.
- `readStar`'s options are now `ReadStarOptions`: `{ maxMetaLength?, maxKeyLength?, maxValueLength? }`. An unset limit is now unlimited; previously there were built-in caps. Pass limits when reading untrusted input. `@atproto/space` exports `REPO_STAR_LIMITS` and `SPACE_META_STAR_LIMITS` for its two profiles.
- `readRepoStar`, `verifyRepoStar`, `verifyRepoStarFull`, and `readSpaceMetaStar` enforce their profile's limits. Their signatures are unchanged.
- `StarParseError` messages changed: `missing metadata` and `missing value for key` are gone, and `invalid control byte` and `unexpected bytes after end of archive` are new. Update tests that match on messages.
- `@atproto/car` no longer exports `createBytesReader`, `BytesReader`, or `encodeVarInt`, which earlier alpha releases exported for STAR. There is no exported replacement.
- `@atproto/api` adds `RepoTakendownError` and `RepoDeactivatedError` for getSpaceCredential and listRepos. Projects that maintain `@atproto/lex` bindings can regenerate them to pick up the new error names.

4. Upgrade a deployment of the reference PDS.

There are no database migrations and no configuration or environment variable changes. Upgrade the `@atproto/pds` dependency or the `ghcr.io/bluesky-social/atproto:pds-spaces-alpha` image. Once upgraded, the PDS reads and writes only the new STAR framing, so getRepo consumers and account migration peers must be upgraded too. Spaces whose authority is already taken down or deactivated stop issuing credentials immediately.

5. Verify and report.

Validate the changed surface in proportion to what this project owns. For a dependency-only update, run the available build/typecheck and focused tests or a smoke check of the existing flow. For projects implementing STAR themselves, run the interop fixtures if practical, and choose regression tests from: round-trip with the end byte; an empty archive; rejecting a missing end byte, a bad control byte, and trailing bytes; and the profile limits. For space hosts, choose from: the new errors on getSpaceCredential and listRepos for a taken-down or deactivated authority; refusing management methods; and allowing exports with a takendown session. This is a menu, not a required suite.

Finish with a concise summary of what applied, exact dependency versions changed, validation results, and any blockers. A no-change result with evidence is valid. Stop once the project's existing functionality is compatible.
