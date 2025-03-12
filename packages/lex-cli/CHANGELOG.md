# @atproto/lex-cli

## 0.7.1

### Patch Changes

- Updated dependencies [[`670b6b5de`](https://github.com/bluesky-social/atproto/commit/670b6b5de2bf91e6944761c98eb1126fb6a681ee)]:
  - @atproto/syntax@0.4.0
  - @atproto/lexicon@0.4.9

## 0.7.0

### Minor Changes

- [#3282](https://github.com/bluesky-social/atproto/pull/3282) [`c501715b0`](https://github.com/bluesky-social/atproto/commit/c501715b0dbe6daad962e1df80986521d00f65aa) Thanks [@tcyrus](https://github.com/tcyrus)! - Fix type-only imports in codegen

## 0.6.2

### Patch Changes

- Updated dependencies [[`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29)]:
  - @atproto/syntax@0.3.4
  - @atproto/lexicon@0.4.8

## 0.6.1

### Patch Changes

- [#3534](https://github.com/bluesky-social/atproto/pull/3534) [`175f89f8f`](https://github.com/bluesky-social/atproto/commit/175f89f8fe0e570518e32b48e49f5bbf63395b67) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve compatibility with Windows runtimes.

## 0.6.0

### Minor Changes

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update the code generation to better reflect the data typings. In particular this change will cause generated code to explicit the `$type` property that can be present in the data.

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `[string]: unknown` index signature from custom user objects, input and output schemas.

### Patch Changes

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `.js` file extension to `import` statements in generated code.

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Type the generated `ids` object (that contains all the lexicon namespace ids) as `const`.

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Ensures that empty `schemas` arrays are typed as `LexiconDoc[]`.

- Updated dependencies [[`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c), [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c), [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c)]:
  - @atproto/syntax@0.3.3
  - @atproto/lexicon@0.4.7

## 0.5.7

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update NodeJS engine requirement to >=18.7.0

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto/lexicon@0.4.6
  - @atproto/syntax@0.3.2

## 0.5.6

### Patch Changes

- [#3420](https://github.com/bluesky-social/atproto/pull/3420) [`6241f6b00`](https://github.com/bluesky-social/atproto/commit/6241f6b00b8728cd5f5e879591b0ca98308edab0) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Expose resetRouteRateLimits to the handler context

## 0.5.5

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.4.5

## 0.5.4

### Patch Changes

- [#3274](https://github.com/bluesky-social/atproto/pull/3274) [`672243a9e`](https://github.com/bluesky-social/atproto/commit/672243a9ea0a2cbd0cfaa4e255c58de658ed22e2) Thanks [@dholms](https://github.com/dholms)! - Allow ratelimit calcKey to return null

## 0.5.3

### Patch Changes

- Updated dependencies [[`9fd65ba0f`](https://github.com/bluesky-social/atproto/commit/9fd65ba0fa4caca59fd0e6156145e4c2618e3a95)]:
  - @atproto/lexicon@0.4.4

## 0.5.2

### Patch Changes

- [#2911](https://github.com/bluesky-social/atproto/pull/2911) [`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Retain type of `schemas` using definition type instead of obscuring into a `LexiconDoc[]`

- Updated dependencies [[`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d), [`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d)]:
  - @atproto/syntax@0.3.1
  - @atproto/lexicon@0.4.3

## 0.5.1

### Patch Changes

- Updated dependencies [[`87a1f2426`](https://github.com/bluesky-social/atproto/commit/87a1f24262e0e644b6cf31cc7a0446d9127ffa94)]:
  - @atproto/lexicon@0.4.2

## 0.5.0

### Minor Changes

- [#2707](https://github.com/bluesky-social/atproto/pull/2707) [`2bdf75d7a`](https://github.com/bluesky-social/atproto/commit/2bdf75d7a63924c10e7a311f16cb447d595b933e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The generated client implementation uses the new `XrpcClient` class from `@atproto/xrpc`, instead of the deprecated `Client` and `ServiceClient` class.

### Patch Changes

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`2bdf75d7a`](https://github.com/bluesky-social/atproto/commit/2bdf75d7a63924c10e7a311f16cb447d595b933e)]:
  - @atproto/lexicon@0.4.1

## 0.4.1

### Patch Changes

- [#2691](https://github.com/bluesky-social/atproto/pull/2691) [`08ef309c9`](https://github.com/bluesky-social/atproto/commit/08ef309c9c1f35f0e7093cb845321e876133d23e) Thanks [@dholms](https://github.com/dholms)! - Fix use of prettier.format for codegen

## 0.4.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/lexicon@0.4.0
  - @atproto/syntax@0.3.0

## 0.3.2

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.3.3
  - @atproto/syntax@0.2.1

## 0.3.1

### Patch Changes

- Updated dependencies [[`0c815b964`](https://github.com/bluesky-social/atproto/commit/0c815b964c030aa0f277c40bf9786f130dc320f4)]:
  - @atproto/syntax@0.2.0
  - @atproto/lexicon@0.3.2

## 0.3.0

### Minor Changes

- [#2039](https://github.com/bluesky-social/atproto/pull/2039) [`bf8d718c`](https://github.com/bluesky-social/atproto/commit/bf8d718cf918ac8d8a2cb1f57fde80535284642d) Thanks [@dholms](https://github.com/dholms)! - Namespace lexicon codegen

## 0.2.5

### Patch Changes

- Updated dependencies [[`3c0ef382`](https://github.com/bluesky-social/atproto/commit/3c0ef382c12a413cc971ae47ffb341236c545f60)]:
  - @atproto/syntax@0.1.5
  - @atproto/lexicon@0.3.1

## 0.2.4

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89), [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/lexicon@0.3.0
  - @atproto/syntax@0.1.4

## 0.2.3

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.2.3
  - @atproto/syntax@0.1.3

## 0.2.2

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.2.2
  - @atproto/syntax@0.1.2

## 0.2.1

### Patch Changes

- Updated dependencies [[`b1dc3555`](https://github.com/bluesky-social/atproto/commit/b1dc355504f9f2e047093dc56682b8034518cf80)]:
  - @atproto/syntax@0.1.1
  - @atproto/lexicon@0.2.1
