---
'@atproto/syntax': minor
---

Support AT URIs that address [permissioned space](https://github.com/bluesky-social/proposals/tree/main/0016-permissioned-data) data: `at://{spaceDid}/space/{spaceType}/{skey}` for a space, followed by `/{authorDid}/{collection}/{rkey}` for a record within it.

- `parseAtUriString()`, `isAtUriString()` and the other AT URI validators accept space URIs, whose authority and author must be DIDs. `AtUriParts` is now `PublicAtUriParts | SpaceAtUriParts`, discriminated by `isSpace`.
- Add `isSpaceAtUriString()` (`SpaceAtUriString`), `isPublicAtUriString()`, `isSpaceRefString()` (`SpaceRefString`), the `SPACE_MARKER` constant, and the `SpaceRef` class: `SpaceRef.parse()` reads a space ref, `SpaceRef.for()` the space any space URI belongs to, and `recordUri(authorDid, collection, rkey)` builds the URI of a record in the space.
- `AtUri` gains `isSpace`, `authorDid`, `spaceDid`, `spaceType` and `skey`. On a space URI, `collection` and `rkey` (and `unsafelySetCollection()` and `unsafelySetRkey()`) address the record part. `AtUri#did` is deprecated, as it is ambiguous on space URIs.
