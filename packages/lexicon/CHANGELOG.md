# @atproto/lexicon

## 0.4.12

### Patch Changes

- [#3999](https://github.com/bluesky-social/atproto/pull/3999) [`8ef976d38`](https://github.com/bluesky-social/atproto/commit/8ef976d3852df4bfa376e515e131cc0810a42f20) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve return type of `assertValidXrpcParams`

## 0.4.11

### Patch Changes

- [#3798](https://github.com/bluesky-social/atproto/pull/3798) [`cc485d296`](https://github.com/bluesky-social/atproto/commit/cc485d29638488928b5efec3d4b0627040589812) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve typing of `BlobRef.toJSON()`

- Updated dependencies [[`cc485d296`](https://github.com/bluesky-social/atproto/commit/cc485d29638488928b5efec3d4b0627040589812)]:
  - @atproto/common-web@0.4.2

## 0.4.10

### Patch Changes

- Updated dependencies [[`4db923ca1`](https://github.com/bluesky-social/atproto/commit/4db923ca1c4fadd31d41c851933659e5186ee144)]:
  - @atproto/common-web@0.4.1

## 0.4.9

### Patch Changes

- Updated dependencies [[`670b6b5de`](https://github.com/bluesky-social/atproto/commit/670b6b5de2bf91e6944761c98eb1126fb6a681ee)]:
  - @atproto/syntax@0.4.0

## 0.4.8

### Patch Changes

- Updated dependencies [[`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29)]:
  - @atproto/syntax@0.3.4

## 0.4.7

### Patch Changes

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Various performance improvements

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fully type `ValidationResult`'s `value` property, allowing `NS.validateMyType` helper functions to return a typed value in case of success.

- Updated dependencies [[`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c)]:
  - @atproto/syntax@0.3.3

## 0.4.6

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`8a30e0ed9`](https://github.com/bluesky-social/atproto/commit/8a30e0ed9239cb2037d54fb98e70e8b0cfbc3e39)]:
  - @atproto/common-web@0.4.0
  - @atproto/syntax@0.3.2

## 0.4.5

### Patch Changes

- Updated dependencies [[`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99), [`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99)]:
  - @atproto/common-web@0.3.2

## 0.4.4

### Patch Changes

- [#3223](https://github.com/bluesky-social/atproto/pull/3223) [`9fd65ba0f`](https://github.com/bluesky-social/atproto/commit/9fd65ba0fa4caca59fd0e6156145e4c2618e3a95) Thanks [@gaearon](https://github.com/gaearon)! - Add fast paths that skip UTF8 encoding

## 0.4.3

### Patch Changes

- [#2911](https://github.com/bluesky-social/atproto/pull/2911) [`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve validation performances by using discriminated unions where possible

- Updated dependencies [[`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d)]:
  - @atproto/syntax@0.3.1

## 0.4.2

### Patch Changes

- [#2817](https://github.com/bluesky-social/atproto/pull/2817) [`87a1f2426`](https://github.com/bluesky-social/atproto/commit/87a1f24262e0e644b6cf31cc7a0446d9127ffa94) Thanks [@gaearon](https://github.com/gaearon)! - Add fast path skipping grapheme counting

- Updated dependencies [[`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`eb20ff64a`](https://github.com/bluesky-social/atproto/commit/eb20ff64a2d8e3061c652e1e247bf9b0fe3c41a6)]:
  - @atproto/common-web@0.3.1

## 0.4.1

### Patch Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add the ability to instantiate a Lexicon from an iterable, and to use a Lexicon as iterable.

- [#2707](https://github.com/bluesky-social/atproto/pull/2707) [`2bdf75d7a`](https://github.com/bluesky-social/atproto/commit/2bdf75d7a63924c10e7a311f16cb447d595b933e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove internal circular dependency.

## 0.4.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/common-web@0.3.0
  - @atproto/syntax@0.3.0

## 0.3.3

### Patch Changes

- Updated dependencies [[`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0)]:
  - @atproto/common-web@0.2.4
  - @atproto/syntax@0.2.1

## 0.3.2

### Patch Changes

- Updated dependencies [[`0c815b964`](https://github.com/bluesky-social/atproto/commit/0c815b964c030aa0f277c40bf9786f130dc320f4)]:
  - @atproto/syntax@0.2.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`3c0ef382`](https://github.com/bluesky-social/atproto/commit/3c0ef382c12a413cc971ae47ffb341236c545f60)]:
  - @atproto/syntax@0.1.5

## 0.3.0

### Minor Changes

- [#1801](https://github.com/bluesky-social/atproto/pull/1801) [`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89) Thanks [@gaearon](https://github.com/gaearon)! - Methods that accepts lexicons now take `LexiconDoc` type instead of `unknown`

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/common-web@0.2.3
  - @atproto/syntax@0.1.4

## 0.2.3

### Patch Changes

- Updated dependencies [[`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7)]:
  - @atproto/common-web@0.2.2
  - @atproto/syntax@0.1.3

## 0.2.2

### Patch Changes

- Updated dependencies [[`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b)]:
  - @atproto/common-web@0.2.1
  - @atproto/syntax@0.1.2

## 0.2.1

### Patch Changes

- Updated dependencies [[`b1dc3555`](https://github.com/bluesky-social/atproto/commit/b1dc355504f9f2e047093dc56682b8034518cf80)]:
  - @atproto/syntax@0.1.1
