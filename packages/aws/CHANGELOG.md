# @atproto/aws

## 0.3.7

### Patch Changes

- [#5233](https://github.com/bluesky-social/atproto/pull/5233) [`692ec0b`](https://github.com/bluesky-social/atproto/commit/692ec0bf7202227f26298ebe98ff25e46b1bd4bc) Thanks [@devinivy](https://github.com/devinivy)! - Upgrade `@aws-sdk/*` dependencies (^3.879.0 to ^3.1073.0). `S3BlobStore` now passes its stall detection timeout (`requestTimeoutMs`) to the request handler's `socketTimeout` option: the upgraded SDK redefined `requestTimeout` from a socket idle timeout to a warn-only total request timer, so stalled S3 connections continue to be reaped and retried as intended.

## 0.3.6

### Patch Changes

- Updated dependencies []:
  - @atproto/common-web@0.5.6
  - @atproto/repo@0.10.6
  - @atproto/common@0.7.2

## 0.3.5

### Patch Changes

- [#5181](https://github.com/bluesky-social/atproto/pull/5181) [`bd0d2ce`](https://github.com/bluesky-social/atproto/commit/bd0d2cea00e6739cb9efc0f80a808ee76bd7b112) Thanks [@blackmichael](https://github.com/blackmichael)! - `S3BlobStore`: decouple the per-request stall detection timeout (`requestTimeoutMs`, a socket idle timeout) from the total upload budget (`uploadTimeoutMs`). `requestTimeoutMs` now defaults to `min(uploadTimeoutMs, 15s)` (clamped to a minimum of 6s) instead of `uploadTimeoutMs`, so that stalled S3 connections are reaped and retried quickly even when a large upload timeout is configured. The 6s floor keeps the socket idle timeout from applying to blob downloads streamed to slow (client-paced) consumers. Also adds a `connectionTimeoutMs` option (default 5s), and translates stalled-connection `TimeoutError`s into the same "Blob upload timed out" error as upload timeouts.

- [#5197](https://github.com/bluesky-social/atproto/pull/5197) [`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite import statements to be compatible with TypeScript's `verbatimModuleSyntax` config.

- Updated dependencies [[`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f)]:
  - @atproto/common-web@0.5.5
  - @atproto/common@0.7.1
  - @atproto/crypto@0.5.4
  - @atproto/repo@0.10.5

## 0.3.4

### Patch Changes

- Updated dependencies [[`d1be0ce`](https://github.com/bluesky-social/atproto/commit/d1be0cead444ef95e64cac5ea5318edbec9d8112)]:
  - @atproto/common@0.7.0
  - @atproto/common-web@0.5.4
  - @atproto/repo@0.10.4

## 0.3.3

### Patch Changes

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build with `noImplicitAny` enabled

- Updated dependencies [[`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07)]:
  - @atproto/common-web@0.5.3
  - @atproto/common@0.6.5
  - @atproto/crypto@0.5.3
  - @atproto/repo@0.10.3

## 0.3.2

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

- Updated dependencies [[`f2cf8f7`](https://github.com/bluesky-social/atproto/commit/f2cf8f7fc5f3a10847f2e6d785e5fa2244ee8cfb), [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7), [`f2cf8f7`](https://github.com/bluesky-social/atproto/commit/f2cf8f7fc5f3a10847f2e6d785e5fa2244ee8cfb)]:
  - @atproto/common@0.6.4
  - @atproto/common-web@0.5.2
  - @atproto/crypto@0.5.2
  - @atproto/repo@0.10.2

## 0.3.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/common-web@0.5.1
  - @atproto/common@0.6.3
  - @atproto/crypto@0.5.1
  - @atproto/repo@0.10.1

## 0.3.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`affb50c`](https://github.com/bluesky-social/atproto/commit/affb50c040b497a12631df99a6310f8e78cab557), [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/common@0.6.0
  - @atproto/common-web@0.5.0
  - @atproto/crypto@0.5.0
  - @atproto/repo@0.10.0

## 0.2.32

### Patch Changes

- Updated dependencies [[`d0c136c`](https://github.com/bluesky-social/atproto/commit/d0c136cba2ec8fa97017849b1023d5af5d2cc60c), [`d0c136c`](https://github.com/bluesky-social/atproto/commit/d0c136cba2ec8fa97017849b1023d5af5d2cc60c), [`d0c136c`](https://github.com/bluesky-social/atproto/commit/d0c136cba2ec8fa97017849b1023d5af5d2cc60c), [`d0c136c`](https://github.com/bluesky-social/atproto/commit/d0c136cba2ec8fa97017849b1023d5af5d2cc60c)]:
  - @atproto/repo@0.9.0

## 0.2.31

### Patch Changes

- Updated dependencies [[`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7)]:
  - @atproto/common-web@0.4.4
  - @atproto/common@0.5.0
  - @atproto/repo@0.8.11
  - @atproto/crypto@0.4.4

## 0.2.30

### Patch Changes

- Updated dependencies [[`8dd77bad2`](https://github.com/bluesky-social/atproto/commit/8dd77bad2fdee20e39d3787198d960c19d8df3d0)]:
  - @atproto/repo@0.8.10

## 0.2.29

### Patch Changes

- [#4169](https://github.com/bluesky-social/atproto/pull/4169) [`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Optimistically attempt to move files before checking for their existence, resulting in faster `makePermanent` calls

- [#4169](https://github.com/bluesky-social/atproto/pull/4169) [`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099) Thanks [@matthieusieben](https://github.com/matthieusieben)! - `S3BlobStore`'s `deleteMany` now supports any number of input (and will process deletes by chunks internally)

- [#4169](https://github.com/bluesky-social/atproto/pull/4169) [`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update `@aws-sdk` dependencies

- [#4169](https://github.com/bluesky-social/atproto/pull/4169) [`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Set a timeout (of 10 seconds by default) on every `S3BlobStore` requests

- Updated dependencies [[`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099), [`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099), [`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099)]:
  - @atproto/repo@0.8.9
  - @atproto/common-web@0.4.3
  - @atproto/common@0.4.12
  - @atproto/crypto@0.4.4

## 0.2.28

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.8.8

## 0.2.27

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.8.7

## 0.2.26

### Patch Changes

- Updated dependencies [[`331a356ce`](https://github.com/bluesky-social/atproto/commit/331a356ce27ff1d0b24747b0c16f3b54b07a0a12)]:
  - @atproto/repo@0.8.6

## 0.2.25

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.8.5

## 0.2.24

### Patch Changes

- Updated dependencies [[`a8dee6af3`](https://github.com/bluesky-social/atproto/commit/a8dee6af33618d3072ebae7f23843242a32c926c)]:
  - @atproto/repo@0.8.4

## 0.2.23

### Patch Changes

- Updated dependencies [[`5fccbd2a1`](https://github.com/bluesky-social/atproto/commit/5fccbd2a14420e4a7c6f56ad9af4ecfe15a971e3)]:
  - @atproto/repo@0.8.3

## 0.2.22

### Patch Changes

- Updated dependencies [[`8bd45e2f8`](https://github.com/bluesky-social/atproto/commit/8bd45e2f898a87b3550c7f4a0c8312fad9cb4736)]:
  - @atproto/repo@0.8.2

## 0.2.21

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.4.11
  - @atproto/repo@0.8.1
  - @atproto/crypto@0.4.4

## 0.2.20

### Patch Changes

- Updated dependencies [[`4db923ca1`](https://github.com/bluesky-social/atproto/commit/4db923ca1c4fadd31d41c851933659e5186ee144), [`4db923ca1`](https://github.com/bluesky-social/atproto/commit/4db923ca1c4fadd31d41c851933659e5186ee144)]:
  - @atproto/repo@0.8.0
  - @atproto/common@0.4.10
  - @atproto/crypto@0.4.4

## 0.2.19

### Patch Changes

- Updated dependencies [[`bdbd3c3e3`](https://github.com/bluesky-social/atproto/commit/bdbd3c3e3f8fe8476a3fecac73810554846c938f), [`bdbd3c3e3`](https://github.com/bluesky-social/atproto/commit/bdbd3c3e3f8fe8476a3fecac73810554846c938f)]:
  - @atproto/repo@0.7.3
  - @atproto/common@0.4.9
  - @atproto/crypto@0.4.4

## 0.2.18

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.7.2

## 0.2.17

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.7.1

## 0.2.16

### Patch Changes

- Updated dependencies [[`7e3678c08`](https://github.com/bluesky-social/atproto/commit/7e3678c089d2faa1a884a52a4fb80b8116c9854f)]:
  - @atproto/repo@0.7.0

## 0.2.15

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.6.5

## 0.2.14

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update NodeJS engine requirement to >=18.7.0

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto/common@0.4.8
  - @atproto/crypto@0.4.4
  - @atproto/repo@0.6.4

## 0.2.13

### Patch Changes

- Updated dependencies [[`52c687a05`](https://github.com/bluesky-social/atproto/commit/52c687a05c70d5660fae1de9e1bbc6297f37f1f4)]:
  - @atproto/common@0.4.7
  - @atproto/crypto@0.4.3
  - @atproto/repo@0.6.3

## 0.2.12

### Patch Changes

- Updated dependencies [[`1abfd74ec`](https://github.com/bluesky-social/atproto/commit/1abfd74ec7114e5d8e2411f7a4fa10bdce97e277)]:
  - @atproto/crypto@0.4.3
  - @atproto/repo@0.6.2

## 0.2.11

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.4.6
  - @atproto/repo@0.6.1
  - @atproto/crypto@0.4.2

## 0.2.10

### Patch Changes

- Updated dependencies [[`588baae12`](https://github.com/bluesky-social/atproto/commit/588baae1212a3cba3bf0d95d2f268e80513fd9c4), [`c9848edaf`](https://github.com/bluesky-social/atproto/commit/c9848edaf0947727aa5a60e3c67eecda3f48d46a)]:
  - @atproto/common@0.4.5
  - @atproto/repo@0.6.0
  - @atproto/crypto@0.4.2

## 0.2.9

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.5.5

## 0.2.8

### Patch Changes

- Updated dependencies [[`1982693e3`](https://github.com/bluesky-social/atproto/commit/1982693e3ea1fef4db76ac9aca3db8dc5ebf3fe0)]:
  - @atproto/crypto@0.4.2
  - @atproto/repo@0.5.4

## 0.2.7

### Patch Changes

- Updated dependencies [[`4098d9890`](https://github.com/bluesky-social/atproto/commit/4098d9890173f4d6c6512f2d8994eebbf12b5e13)]:
  - @atproto/common@0.4.4
  - @atproto/crypto@0.4.1
  - @atproto/repo@0.5.3

## 0.2.6

### Patch Changes

- Updated dependencies [[`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3)]:
  - @atproto/common@0.4.3
  - @atproto/repo@0.5.2
  - @atproto/crypto@0.4.1

## 0.2.5

### Patch Changes

- Updated dependencies [[`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93)]:
  - @atproto/common@0.4.2
  - @atproto/crypto@0.4.1
  - @atproto/repo@0.5.1

## 0.2.4

### Patch Changes

- Updated dependencies [[`b15dec2f4`](https://github.com/bluesky-social/atproto/commit/b15dec2f4feb25ac91b169c83ccff1adbb5a9442)]:
  - @atproto/repo@0.5.0

## 0.2.3

### Patch Changes

- Updated dependencies [[`ebb318325`](https://github.com/bluesky-social/atproto/commit/ebb318325b6e80c4ea1a93a617569da2698afe31)]:
  - @atproto/crypto@0.4.1
  - @atproto/repo@0.4.3

## 0.2.2

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.4.2

## 0.2.1

### Patch Changes

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto/common@0.4.1
  - @atproto/crypto@0.4.0
  - @atproto/repo@0.4.1

## 0.2.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/common@0.4.0
  - @atproto/crypto@0.4.0
  - @atproto/repo@0.4.0

## 0.1.9

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.3.4
  - @atproto/repo@0.3.9
  - @atproto/crypto@0.3.0

## 0.1.8

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.3.8

## 0.1.7

### Patch Changes

- Updated dependencies [[`fcf8e3faf`](https://github.com/bluesky-social/atproto/commit/fcf8e3faf311559162c3aa0d9af36f84951914bc)]:
  - @atproto/repo@0.3.7

## 0.1.6

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.3.6

## 0.1.5

### Patch Changes

- Updated dependencies [[`e1b5f253`](https://github.com/bluesky-social/atproto/commit/e1b5f2537a5ba4d8b951a741269b604856028ae5)]:
  - @atproto/crypto@0.3.0
  - @atproto/repo@0.3.5

## 0.1.4

### Patch Changes

- Updated dependencies [[`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/common@0.3.3
  - @atproto/crypto@0.2.3
  - @atproto/repo@0.3.4

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.3.3
  - @atproto/common@0.3.2

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.3.2

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @atproto/repo@0.3.1
