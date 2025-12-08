# @atproto/lex-builder

## 0.0.6

### Patch Changes

- [#4413](https://github.com/bluesky-social/atproto/pull/4413) [`e39ca11`](https://github.com/bluesky-social/atproto/commit/e39ca114accac65070dcdd424a181821aad6d99d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for NodeJS version <18.18, 19.x, <20.4 and 21.x

- Updated dependencies [[`d551b0e`](https://github.com/bluesky-social/atproto/commit/d551b0e3527714c111c3ec6e4c90ad7f46369fab)]:
  - @atproto/lex-document@0.0.5
  - @atproto/lex-schema@0.0.4

## 0.0.5

### Patch Changes

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rework object validation logic to work without `options` argument

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `l.nullable` for nullable object properties and `l.optional` for optional object properties in lex schemas.

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace use of `CID` with `Cid`

- [#4389](https://github.com/bluesky-social/atproto/pull/4389) [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use string formats from `@atproto/syntax`

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `knownValues` from string options (as it had not runtime effect)

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename schema methods `validate`, `check` and `maybe` to `safeParse`, `matches` and `ifMatches` respectively.

- [#4397](https://github.com/bluesky-social/atproto/pull/4397) [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `CHANGELOG.md` to npm package

- [#4398](https://github.com/bluesky-social/atproto/pull/4398) [`a17d2e8`](https://github.com/bluesky-social/atproto/commit/a17d2e8a59ceb00fa8197642e0767fcc776d5b70) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `ignoreInvalidLexicons` option when building lexicon schemas

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Strip unknown properties from schema options

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `default` option to `const` and `enum` schemas

- Updated dependencies [[`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`03a2a4b`](https://github.com/bluesky-social/atproto/commit/03a2a4bb3814ced7ad1d4fe6c94b5348a3bbc097), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`9f87ff3`](https://github.com/bluesky-social/atproto/commit/9f87ff3aa60090c8c38b6ce400cba6ceff5cd2e9), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba)]:
  - @atproto/lex-schema@0.0.3
  - @atproto/lex-document@0.0.4

## 0.0.4

### Patch Changes

- [#4380](https://github.com/bluesky-social/atproto/pull/4380) [`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to configure file extenstion and import file extension in `lex build`

- Updated dependencies [[`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4)]:
  - @atproto/lex-schema@0.0.2
  - @atproto/lex-document@0.0.3

## 0.0.3

### Patch Changes

- Updated dependencies [[`5ffd612`](https://github.com/bluesky-social/atproto/commit/5ffd6129909071e979c30f31266119865ab582b6)]:
  - @atproto/lex-document@0.0.2

## 0.0.2

### Patch Changes

- [#4372](https://github.com/bluesky-social/atproto/pull/4372) [`7456f53`](https://github.com/bluesky-social/atproto/commit/7456f53e45fb3eef2f3bbdf2513da2d8ab078d80) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix error when running `install` command

## 0.0.1

### Patch Changes

- [#4371](https://github.com/bluesky-social/atproto/pull/4371) [`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Release

- Updated dependencies [[`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af)]:
  - @atproto/lex-document@0.0.1
  - @atproto/lex-schema@0.0.1
