# @atproto/oauth-scopes

## 0.2.1

### Patch Changes

- Updated dependencies [[`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3)]:
  - @atproto/did@0.2.1

## 0.2.0

### Minor Changes

- [#4149](https://github.com/bluesky-social/atproto/pull/4149) [`8914f9abd`](https://github.com/bluesky-social/atproto/commit/8914f9abde2059c551d7e4c8d104227986098b82) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Method `authenticateRequest` now returns `SignedTokenPayload`

### Patch Changes

- [#4149](https://github.com/bluesky-social/atproto/pull/4149) [`8914f9abd`](https://github.com/bluesky-social/atproto/commit/8914f9abde2059c551d7e4c8d104227986098b82) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add scope normalization utility

- Updated dependencies []:
  - @atproto/lexicon@0.5.1

## 0.1.0

### Minor Changes

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rework scope parsing utilities to work with Lexicon defined permissions

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use strict NSID validation. repo & rpc scopes with invalid NSIDs will be rejected.

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `PermissionSet` to `ScopePermissions`

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Renaming of "resource" concept to better reflect the fact that not all oauth scope values are about resources

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Enforce proper formatting of audience (atproto supported did + fragment part)

### Patch Changes

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Ignore empty string when building a `ScopePermissions`

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export constants and type assertion utilities

- Updated dependencies [[`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d)]:
  - @atproto/lexicon@0.5.0
  - @atproto/syntax@0.4.1
  - @atproto/did@0.2.0

## 0.0.2

### Patch Changes

- [#4097](https://github.com/bluesky-social/atproto/pull/4097) [`c274bd1b3`](https://github.com/bluesky-social/atproto/commit/c274bd1b38813abd5b287f1c94dca1fd62854918) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix permission bug with `transition:email` scope

## 0.0.1

### Patch Changes

- [#3806](https://github.com/bluesky-social/atproto/pull/3806) [`1899b1fc1`](https://github.com/bluesky-social/atproto/commit/1899b1fc16bc5cd7bb930ec697898766c3a05add) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Initial implementation of library used to parse ATProto OAuth scopes
