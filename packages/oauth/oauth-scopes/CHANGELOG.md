# @atproto/oauth-scopes

## 0.5.6

### Patch Changes

- Updated dependencies [[`9e1da84`](https://github.com/bluesky-social/atproto/commit/9e1da84cc00a1cc5b453705539a2766403f3ee55)]:
  - @atproto/syntax@0.7.2

## 0.5.5

### Patch Changes

- [#5197](https://github.com/bluesky-social/atproto/pull/5197) [`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite import statements to be compatible with TypeScript's `verbatimModuleSyntax` config.

- Updated dependencies [[`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f)]:
  - @atproto/syntax@0.7.1
  - @atproto/did@0.5.4

## 0.5.4

### Patch Changes

- Updated dependencies [[`d1be0ce`](https://github.com/bluesky-social/atproto/commit/d1be0cead444ef95e64cac5ea5318edbec9d8112), [`d79f6d5`](https://github.com/bluesky-social/atproto/commit/d79f6d59a073c05cc37bd0d1482beeea482b67ed)]:
  - @atproto/syntax@0.7.0

## 0.5.3

### Patch Changes

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

- Updated dependencies [[`28a0b58`](https://github.com/bluesky-social/atproto/commit/28a0b588147863eaef948cd2bb8fc0f19d08cda9), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07)]:
  - @atproto/syntax@0.6.4
  - @atproto/did@0.5.3

## 0.5.2

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

- Updated dependencies [[`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7)]:
  - @atproto/did@0.5.2
  - @atproto/syntax@0.6.3

## 0.5.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/syntax@0.6.2
  - @atproto/did@0.5.1

## 0.5.0

### Minor Changes

- [#4992](https://github.com/bluesky-social/atproto/pull/4992) [`622d365`](https://github.com/bluesky-social/atproto/commit/622d365aeb240133f40763a3b1c43981112837fc) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Remove the `AtprotoAudience` and `isAtprotoAudience` re-exports. They are superseded by `AtprotoDidRefAbsolute` and `isAtprotoDidRefAbsolute`, also re-exported from this package.

### Patch Changes

- Updated dependencies [[`622d365`](https://github.com/bluesky-social/atproto/commit/622d365aeb240133f40763a3b1c43981112837fc)]:
  - @atproto/did@0.5.0

## 0.4.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/did@0.4.0
  - @atproto/syntax@0.6.0

## 0.3.2

### Patch Changes

- Updated dependencies [[`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd)]:
  - @atproto/syntax@0.5.0

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
