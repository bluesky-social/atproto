# @atproto/oauth-scopes

## 0.3.1

### Patch Changes

- Updated dependencies [[`d54d707`](https://github.com/bluesky-social/atproto/commit/d54d7077eb32041e1f61c312efa1dd0d768c774e), [`d54d707`](https://github.com/bluesky-social/atproto/commit/d54d7077eb32041e1f61c312efa1dd0d768c774e)]:
  - @atproto/did@0.3.0

## 0.3.0

### Minor Changes

- [#4383](https://github.com/bluesky-social/atproto/pull/4383) [`8012627`](https://github.com/bluesky-social/atproto/commit/8012627a1226cb2f1c753385ad2497b6b43ffd2e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace `@atproto/lexicon` with `@atproto/lex-document`

- [#4353](https://github.com/bluesky-social/atproto/pull/4353) [`0adc852`](https://github.com/bluesky-social/atproto/commit/0adc852c31ffa154c1b93e38182c35880ecdb4ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use arrays to represent "account" permission's `action` attribute, allowing multiple actions to be specified for that resource.

### Patch Changes

- [#4382](https://github.com/bluesky-social/atproto/pull/4382) [`be8e6c1`](https://github.com/bluesky-social/atproto/commit/be8e6c1f25814202b98e2616a217599a6c46e0db) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `toScopes()` utility on `IncludeScope`

- [#4382](https://github.com/bluesky-social/atproto/pull/4382) [`be8e6c1`](https://github.com/bluesky-social/atproto/commit/be8e6c1f25814202b98e2616a217599a6c46e0db) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove ability to define `blob` permission in permission sets

- [#4383](https://github.com/bluesky-social/atproto/pull/4383) [`8012627`](https://github.com/bluesky-social/atproto/commit/8012627a1226cb2f1c753385ad2497b6b43ffd2e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace `@atproto/lexicon-resolver` with `@atproto/lex-resolver`

- [#4353](https://github.com/bluesky-social/atproto/pull/4353) [`0adc852`](https://github.com/bluesky-social/atproto/commit/0adc852c31ffa154c1b93e38182c35880ecdb4ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow lexicon permission data to be readonly

- [#4382](https://github.com/bluesky-social/atproto/pull/4382) [`be8e6c1`](https://github.com/bluesky-social/atproto/commit/be8e6c1f25814202b98e2616a217599a6c46e0db) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Disallow `rpc` permissions with specific `aud` in permission-sets

- Updated dependencies [[`8012627`](https://github.com/bluesky-social/atproto/commit/8012627a1226cb2f1c753385ad2497b6b43ffd2e), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`d396de0`](https://github.com/bluesky-social/atproto/commit/d396de016d1d55d08cfad1dabd3ffd9eaeea76ea)]:
  - @atproto/did@0.2.3
  - @atproto/syntax@0.4.2

## 0.2.2

### Patch Changes

- Updated dependencies [[`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7)]:
  - @atproto/did@0.2.2
  - @atproto/lexicon@0.5.2

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
