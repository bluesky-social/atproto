# @atproto/common

## 0.6.3

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/lex-cbor@0.1.1
  - @atproto/lex-data@0.1.2
  - @atproto/common-web@0.5.1

## 0.6.2

### Patch Changes

- [#5080](https://github.com/bluesky-social/atproto/pull/5080) [`b2c098f`](https://github.com/bluesky-social/atproto/commit/b2c098fdfa26137bb6f7d092ef89757e39748353) Thanks [@devinivy](https://github.com/devinivy)! - Make rmIfExists() more robust to partial failures.

- [#5078](https://github.com/bluesky-social/atproto/pull/5078) [`cc329bf`](https://github.com/bluesky-social/atproto/commit/cc329bf55c658752675d561dba792fedbe9c2626) Thanks [@jcalabro](https://github.com/jcalabro)! - Add `coalesceByteStream` utility to coalesce a byte stream into chunks with a minimal size.

## 0.6.1

### Patch Changes

- [#4954](https://github.com/bluesky-social/atproto/pull/4954) [`e6c6343`](https://github.com/bluesky-social/atproto/commit/e6c6343bd3727455bd0da12300bb4929a944e4f1) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add back support for any `Uint8Array` as input to the `ui8ToArrayBuffer` helper

- Updated dependencies [[`e6c6343`](https://github.com/bluesky-social/atproto/commit/e6c6343bd3727455bd0da12300bb4929a944e4f1)]:
  - @atproto/lex-data@0.1.1

## 0.6.0

### Minor Changes

- [`affb50c`](https://github.com/bluesky-social/atproto/commit/affb50c040b497a12631df99a6310f8e78cab557) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** `ui8ToArrayBuffer(bytes)` now requires `Uint8Array<ArrayBuffer>` (rather than `Uint8Array`, which defaults to `<ArrayBufferLike>`). Most callers can pass the value through unchanged; in the rare case of a `SharedArrayBuffer`-backed `Uint8Array`, copy into a regular `Uint8Array` first.

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/common-web@0.5.0
  - @atproto/lex-cbor@0.1.0
  - @atproto/lex-data@0.1.0

## 0.5.16

### Patch Changes

- Updated dependencies [[`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856), [`f6f100c`](https://github.com/bluesky-social/atproto/commit/f6f100c33700a7ff58a1458109cc7420131feed0), [`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856), [`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856)]:
  - @atproto/lex-data@0.0.15
  - @atproto/common-web@0.4.20
  - @atproto/lex-cbor@0.0.16

## 0.5.15

### Patch Changes

- Updated dependencies [[`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786)]:
  - @atproto/lex-data@0.0.14
  - @atproto/common-web@0.4.19
  - @atproto/lex-cbor@0.0.15

## 0.5.14

### Patch Changes

- [#4689](https://github.com/bluesky-social/atproto/pull/4689) [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove unnecessary validation of already properly formatted ISO date string

- Updated dependencies [[`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7)]:
  - @atproto/lex-data@0.0.13
  - @atproto/common-web@0.4.18
  - @atproto/lex-cbor@0.0.14

## 0.5.13

### Patch Changes

- Updated dependencies [[`66b7295`](https://github.com/bluesky-social/atproto/commit/66b72950e8bcb39cac3382116bd282b3bb692f16)]:
  - @atproto/lex-cbor@0.0.13

## 0.5.12

### Patch Changes

- Updated dependencies [[`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df)]:
  - @atproto/lex-data@0.0.12
  - @atproto/common-web@0.4.17
  - @atproto/lex-cbor@0.0.12

## 0.5.11

### Patch Changes

- Updated dependencies [[`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015)]:
  - @atproto/lex-cbor@0.0.11
  - @atproto/lex-data@0.0.11
  - @atproto/common-web@0.4.16

## 0.5.10

### Patch Changes

- [`49b3806`](https://github.com/bluesky-social/atproto/commit/49b38069ed4b5bd1ef71e967c78e5123b1c1f6f1) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependency on `@atproto/common-web`

- Updated dependencies [[`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a)]:
  - @atproto/lex-data@0.0.10
  - @atproto/common-web@0.4.15
  - @atproto/lex-cbor@0.0.10

## 0.5.9

### Patch Changes

- Updated dependencies [[`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`ecf5921`](https://github.com/bluesky-social/atproto/commit/ecf59214d59d9d2530c197c0679d26e76c6a60ef), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101)]:
  - @atproto/common-web@0.4.13
  - @atproto/lex-cbor@0.0.9
  - @atproto/lex-data@0.0.9

## 0.5.8

### Patch Changes

- Updated dependencies [[`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e)]:
  - @atproto/lex-data@0.0.8
  - @atproto/common-web@0.4.12
  - @atproto/lex-cbor@0.0.8

## 0.5.7

### Patch Changes

- Updated dependencies [[`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe)]:
  - @atproto/lex-data@0.0.7
  - @atproto/lex-cbor@0.0.7
  - @atproto/common-web@0.4.11

## 0.5.6

### Patch Changes

- Updated dependencies [[`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98)]:
  - @atproto/lex-data@0.0.6
  - @atproto/common-web@0.4.10
  - @atproto/lex-cbor@0.0.6

## 0.5.5

### Patch Changes

- Updated dependencies [[`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c)]:
  - @atproto/lex-data@0.0.5
  - @atproto/common-web@0.4.9
  - @atproto/lex-cbor@0.0.5

## 0.5.4

### Patch Changes

- Updated dependencies [[`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece)]:
  - @atproto/lex-data@0.0.4
  - @atproto/lex-cbor@0.0.4
  - @atproto/common-web@0.4.8

## 0.5.3

### Patch Changes

- Updated dependencies [[`693784c`](https://github.com/bluesky-social/atproto/commit/693784c3a0dee4b6a29aa1e018fce682dcae148f), [`693784c`](https://github.com/bluesky-social/atproto/commit/693784c3a0dee4b6a29aa1e018fce682dcae148f), [`7e1d458`](https://github.com/bluesky-social/atproto/commit/7e1d45877bca0f615e7b1313cfcc66823b3de758)]:
  - @atproto/lex-data@0.0.3
  - @atproto/common-web@0.4.7
  - @atproto/lex-cbor@0.0.3

## 0.5.2

### Patch Changes

- Updated dependencies [[`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4)]:
  - @atproto/lex-data@0.0.2
  - @atproto/lex-cbor@0.0.2
  - @atproto/common-web@0.4.6

## 0.5.1

### Patch Changes

- Updated dependencies [[`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af)]:
  - @atproto/lex-cbor@0.0.1
  - @atproto/lex-data@0.0.1
  - @atproto/common-web@0.4.5

## 0.5.0

### Minor Changes

- [#4366](https://github.com/bluesky-social/atproto/pull/4366) [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `utf8ToB64Url` and `b64UrlToUtf8` utilities

- [#4366](https://github.com/bluesky-social/atproto/pull/4366) [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `sha256ToCid` utility

### Patch Changes

- [#4366](https://github.com/bluesky-social/atproto/pull/4366) [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Deprecate "ipld" functions (use `@atproto/lex-data`, `@atproto/lex-json` and `@atproto/lex-cbor` instead)

- Updated dependencies [[`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7)]:
  - @atproto/common-web@0.4.4

## 0.4.12

### Patch Changes

- Updated dependencies [[`055a413fb`](https://github.com/bluesky-social/atproto/commit/055a413fba4fab510ec899377154f1204ab12099)]:
  - @atproto/common-web@0.4.3

## 0.4.11

### Patch Changes

- Updated dependencies [[`cc485d296`](https://github.com/bluesky-social/atproto/commit/cc485d29638488928b5efec3d4b0627040589812)]:
  - @atproto/common-web@0.4.2

## 0.4.10

### Patch Changes

- [#3672](https://github.com/bluesky-social/atproto/pull/3672) [`4db923ca1`](https://github.com/bluesky-social/atproto/commit/4db923ca1c4fadd31d41c851933659e5186ee144) Thanks [@dholms](https://github.com/dholms)! - Add DASL CID parser

- Updated dependencies [[`4db923ca1`](https://github.com/bluesky-social/atproto/commit/4db923ca1c4fadd31d41c851933659e5186ee144)]:
  - @atproto/common-web@0.4.1

## 0.4.9

### Patch Changes

- [#2519](https://github.com/bluesky-social/atproto/pull/2519) [`bdbd3c3e3`](https://github.com/bluesky-social/atproto/commit/bdbd3c3e3f8fe8476a3fecac73810554846c938f) Thanks [@dholms](https://github.com/dholms)! - Add renameIfExists function

## 0.4.8

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update NodeJS engine requirement to >=18.7.0

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`8a30e0ed9`](https://github.com/bluesky-social/atproto/commit/8a30e0ed9239cb2037d54fb98e70e8b0cfbc3e39)]:
  - @atproto/common-web@0.4.0

## 0.4.7

### Patch Changes

- [#3481](https://github.com/bluesky-social/atproto/pull/3481) [`52c687a05`](https://github.com/bluesky-social/atproto/commit/52c687a05c70d5660fae1de9e1bbc6297f37f1f4) Thanks [@dholms](https://github.com/dholms)! - Parse safe uint64 as number

## 0.4.6

### Patch Changes

- Updated dependencies [[`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99), [`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99)]:
  - @atproto/common-web@0.3.2

## 0.4.5

### Patch Changes

- [#3178](https://github.com/bluesky-social/atproto/pull/3178) [`588baae12`](https://github.com/bluesky-social/atproto/commit/588baae1212a3cba3bf0d95d2f268e80513fd9c4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Minor adaptation of VerifyCidTransform

## 0.4.4

### Patch Changes

- [#2834](https://github.com/bluesky-social/atproto/pull/2834) [`4098d9890`](https://github.com/bluesky-social/atproto/commit/4098d9890173f4d6c6512f2d8994eebbf12b5e13) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow contentEncoding to be an array for consistency with typing of headers

## 0.4.3

### Patch Changes

- [#2770](https://github.com/bluesky-social/atproto/pull/2770) [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - add streamToNodeBuffer utility to convert Uint8Array (async) iterables to Buffer

- Updated dependencies [[`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`eb20ff64a`](https://github.com/bluesky-social/atproto/commit/eb20ff64a2d8e3061c652e1e247bf9b0fe3c41a6)]:
  - @atproto/common-web@0.3.1

## 0.4.2

### Patch Changes

- [#2464](https://github.com/bluesky-social/atproto/pull/2464) [`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Minor optimization

## 0.4.1

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add obfuscation utilities

## 0.4.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/common-web@0.3.0

## 0.3.4

### Patch Changes

- Updated dependencies [[`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0)]:
  - @atproto/common-web@0.2.4

## 0.3.3

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/common-web@0.2.3

## 0.3.2

### Patch Changes

- Updated dependencies [[`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7)]:
  - @atproto/common-web@0.2.2

## 0.3.1

### Patch Changes

- Updated dependencies [[`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b)]:
  - @atproto/common-web@0.2.1
