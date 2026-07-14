# @atproto/identity

## 0.5.6

### Patch Changes

- Updated dependencies []:
  - @atproto/common-web@0.5.6

## 0.5.5

### Patch Changes

- [#5197](https://github.com/bluesky-social/atproto/pull/5197) [`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite import statements to be compatible with TypeScript's `verbatimModuleSyntax` config.

- Updated dependencies [[`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f)]:
  - @atproto/common-web@0.5.5
  - @atproto/crypto@0.5.4

## 0.5.4

### Patch Changes

- Updated dependencies []:
  - @atproto/common-web@0.5.4

## 0.5.3

### Patch Changes

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add missing `@types` dependencies

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build with `noImplicitAny` enabled

- Updated dependencies [[`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07)]:
  - @atproto/common-web@0.5.3
  - @atproto/crypto@0.5.3

## 0.5.2

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

- Updated dependencies [[`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7)]:
  - @atproto/common-web@0.5.2
  - @atproto/crypto@0.5.2

## 0.5.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/common-web@0.5.1
  - @atproto/crypto@0.5.1

## 0.5.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/common-web@0.5.0
  - @atproto/crypto@0.5.0

## 0.4.12

### Patch Changes

- [#4669](https://github.com/bluesky-social/atproto/pull/4669) [`dc9644b`](https://github.com/bluesky-social/atproto/commit/dc9644bbeb1892931809568895162d823e4743d2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix lint warning

## 0.4.11

### Patch Changes

- [#4609](https://github.com/bluesky-social/atproto/pull/4609) [`00e6dbd`](https://github.com/bluesky-social/atproto/commit/00e6dbdcea295cfa3dff7eb7517420039cc3e821) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix `method.resolveNoCheck is not a function` error when using speciallt forged did method

- Updated dependencies []:
  - @atproto/common-web@0.4.16

## 0.4.10

### Patch Changes

- Updated dependencies [[`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7)]:
  - @atproto/common-web@0.4.4
  - @atproto/crypto@0.4.4

## 0.4.9

### Patch Changes

- Updated dependencies [[`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099)]:
  - @atproto/common-web@0.4.3
  - @atproto/crypto@0.4.4

## 0.4.8

### Patch Changes

- Updated dependencies [[`cc485d296`](https://github.com/bluesky-social/atproto/commit/cc485d29638488928b5efec3d4b0627040589812)]:
  - @atproto/common-web@0.4.2
  - @atproto/crypto@0.4.4

## 0.4.7

### Patch Changes

- Updated dependencies [[`4db923ca1`](https://github.com/bluesky-social/atproto/commit/4db923ca1c4fadd31d41c851933659e5186ee144)]:
  - @atproto/common-web@0.4.1
  - @atproto/crypto@0.4.4

## 0.4.6

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update NodeJS engine requirement to >=18.7.0

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`8a30e0ed9`](https://github.com/bluesky-social/atproto/commit/8a30e0ed9239cb2037d54fb98e70e8b0cfbc3e39), [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto/common-web@0.4.0
  - @atproto/crypto@0.4.4

## 0.4.5

### Patch Changes

- Updated dependencies [[`1abfd74ec`](https://github.com/bluesky-social/atproto/commit/1abfd74ec7114e5d8e2411f7a4fa10bdce97e277)]:
  - @atproto/crypto@0.4.3

## 0.4.4

### Patch Changes

- [#3177](https://github.com/bluesky-social/atproto/pull/3177) [`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove dependency on Axios

- Updated dependencies [[`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99), [`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99)]:
  - @atproto/common-web@0.3.2
  - @atproto/crypto@0.4.2

## 0.4.3

### Patch Changes

- Updated dependencies [[`1982693e3`](https://github.com/bluesky-social/atproto/commit/1982693e3ea1fef4db76ac9aca3db8dc5ebf3fe0)]:
  - @atproto/crypto@0.4.2

## 0.4.2

### Patch Changes

- Updated dependencies [[`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`eb20ff64a`](https://github.com/bluesky-social/atproto/commit/eb20ff64a2d8e3061c652e1e247bf9b0fe3c41a6)]:
  - @atproto/common-web@0.3.1
  - @atproto/crypto@0.4.1

## 0.4.1

### Patch Changes

- Updated dependencies [[`ebb318325`](https://github.com/bluesky-social/atproto/commit/ebb318325b6e80c4ea1a93a617569da2698afe31)]:
  - @atproto/crypto@0.4.1

## 0.4.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/common-web@0.3.0
  - @atproto/crypto@0.4.0

## 0.3.3

### Patch Changes

- [#2302](https://github.com/bluesky-social/atproto/pull/2302) [`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0) Thanks [@dholms](https://github.com/dholms)! - Added methods for parsing labeler verification methods and services in DID Documents

- Updated dependencies [[`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0)]:
  - @atproto/common-web@0.2.4
  - @atproto/crypto@0.3.0

## 0.3.2

### Patch Changes

- Updated dependencies [[`e1b5f253`](https://github.com/bluesky-social/atproto/commit/e1b5f2537a5ba4d8b951a741269b604856028ae5)]:
  - @atproto/crypto@0.3.0

## 0.3.1

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/common-web@0.2.3
  - @atproto/crypto@0.2.3

## 0.3.0

### Minor Changes

- [#1773](https://github.com/bluesky-social/atproto/pull/1773) [`bb039d8e`](https://github.com/bluesky-social/atproto/commit/bb039d8e4ce5b7f70c4f3e86d1327e210ef24dc3) Thanks [@dholms](https://github.com/dholms)! - Pass stale did doc into refresh cache functions

### Patch Changes

- [`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7) Thanks [@devinivy](https://github.com/devinivy)! - Allow pds to serve did doc with credentials, API client to respect PDS listed in the did doc.

- Updated dependencies [[`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7)]:
  - @atproto/common-web@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [[`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b)]:
  - @atproto/common-web@0.2.1
