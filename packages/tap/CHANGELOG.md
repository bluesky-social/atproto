# @atproto/tap

## 0.3.2

### Patch Changes

- [#5117](https://github.com/bluesky-social/atproto/pull/5117) [`8a4c88b`](https://github.com/bluesky-social/atproto/commit/8a4c88b0f63fb2d82b1391d64c54e0c760fac48b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make tests less flaky in CI

- Updated dependencies [[`8a4c88b`](https://github.com/bluesky-social/atproto/commit/8a4c88b0f63fb2d82b1391d64c54e0c760fac48b)]:
  - @atproto/ws-client@0.1.2

## 0.3.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/ws-client@0.1.1
  - @atproto/lex@0.1.4
  - @atproto/common@0.6.3
  - @atproto/syntax@0.6.2

## 0.3.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`affb50c`](https://github.com/bluesky-social/atproto/commit/affb50c040b497a12631df99a6310f8e78cab557), [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/common@0.6.0
  - @atproto/lex@0.1.0
  - @atproto/syntax@0.6.0
  - @atproto/ws-client@0.1.0

## 0.2.15

### Patch Changes

- Updated dependencies []:
  - @atproto/lex@0.0.27

## 0.2.14

### Patch Changes

- Updated dependencies []:
  - @atproto/lex@0.0.26

## 0.2.13

### Patch Changes

- Updated dependencies [[`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676), [`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676), [`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676), [`55d06de`](https://github.com/bluesky-social/atproto/commit/55d06de80a1506908a04ed5c0834986cb5783797), [`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676)]:
  - @atproto/syntax@0.5.4
  - @atproto/lex@0.0.25

## 0.2.12

### Patch Changes

- Updated dependencies [[`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856)]:
  - @atproto/lex@0.0.24
  - @atproto/common@0.5.16

## 0.2.11

### Patch Changes

- Updated dependencies [[`0dbea15`](https://github.com/bluesky-social/atproto/commit/0dbea15da48a6ca913cc3a3a2d8c0ffe64d7c69a), [`d0c136c`](https://github.com/bluesky-social/atproto/commit/d0c136cba2ec8fa97017849b1023d5af5d2cc60c), [`527f5d4`](https://github.com/bluesky-social/atproto/commit/527f5d4c5d0c9264c2ff6f23ad06a41163fc6809)]:
  - @atproto/syntax@0.5.2
  - @atproto/lex@0.0.23

## 0.2.10

### Patch Changes

- Updated dependencies []:
  - @atproto/lex@0.0.22
  - @atproto/common@0.5.15

## 0.2.9

### Patch Changes

- Updated dependencies [[`67eb0c1`](https://github.com/bluesky-social/atproto/commit/67eb0c19ac415e762e221b2ccda9f0bcf7b3dd6f)]:
  - @atproto/syntax@0.5.1
  - @atproto/lex@0.0.21

## 0.2.8

### Patch Changes

- Updated dependencies [[`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd)]:
  - @atproto/syntax@0.5.0
  - @atproto/lex@0.0.20
  - @atproto/common@0.5.14

## 0.2.7

### Patch Changes

- Updated dependencies [[`38852f0`](https://github.com/bluesky-social/atproto/commit/38852f0ddfa9fbce8036233dc6af87614e9ae4b2)]:
  - @atproto/lex@0.0.19

## 0.2.6

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.5.13
  - @atproto/lex@0.0.18

## 0.2.5

### Patch Changes

- Updated dependencies [[`009c4af`](https://github.com/bluesky-social/atproto/commit/009c4afd3643d4edf4bd05065ec93cab74610bfe)]:
  - @atproto/lex@0.0.17
  - @atproto/common@0.5.12

## 0.2.4

### Patch Changes

- Updated dependencies []:
  - @atproto/lex@0.0.16

## 0.2.3

### Patch Changes

- Updated dependencies [[`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015)]:
  - @atproto/lex@0.0.15
  - @atproto/common@0.5.11

## 0.2.2

### Patch Changes

- Updated dependencies [[`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a), [`49b3806`](https://github.com/bluesky-social/atproto/commit/49b38069ed4b5bd1ef71e967c78e5123b1c1f6f1)]:
  - @atproto/lex@0.0.14
  - @atproto/common@0.5.10

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @atproto/lex@0.0.13

## 0.2.0

### Minor Changes

- [#4532](https://github.com/bluesky-social/atproto/pull/4532) [`aaedafc`](https://github.com/bluesky-social/atproto/commit/aaedafc6baef106b85e0954d8474cec21c00c1c2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose `record` data as parsed atproto data (including CIDs and Uint8Arrays)

### Patch Changes

- [#4532](https://github.com/bluesky-social/atproto/pull/4532) [`aaedafc`](https://github.com/bluesky-social/atproto/commit/aaedafc6baef106b85e0954d8474cec21c00c1c2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace event validation from "zod" to "@atproto/lex"

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add validation error as cause when handling invalid records

- Updated dependencies [[`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b)]:
  - @atproto/syntax@0.4.3
  - @atproto/lex@0.0.12
  - @atproto/common@0.5.9

## 0.1.3

### Patch Changes

- [#4534](https://github.com/bluesky-social/atproto/pull/4534) [`0193467`](https://github.com/bluesky-social/atproto/commit/0193467463a1a49c0c7f17d129c07b687a1f5057) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make sure the `destroy()` promise resolves, even in case of error

- [#4534](https://github.com/bluesky-social/atproto/pull/4534) [`0193467`](https://github.com/bluesky-social/atproto/commit/0193467463a1a49c0c7f17d129c07b687a1f5057) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make `TapChannel` implement `AsyncDisposable`, allowing use with `using` keyword

- Updated dependencies []:
  - @atproto/common@0.5.8
  - @atproto/lex@0.0.11

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.5.7
  - @atproto/lex@0.0.10

## 0.1.1

### Patch Changes

- Updated dependencies [[`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98)]:
  - @atproto/lex@0.0.9
  - @atproto/common@0.5.6

## 0.1.0

### Minor Changes

- [#4483](https://github.com/bluesky-social/atproto/pull/4483) [`e3357e9`](https://github.com/bluesky-social/atproto/commit/e3357e9c781ff84430556f4c891639acfcef3486) Thanks [@dholms](https://github.com/dholms)! - Add LexIndexer

## 0.0.3

### Patch Changes

- [#4481](https://github.com/bluesky-social/atproto/pull/4481) [`e15e7cf`](https://github.com/bluesky-social/atproto/commit/e15e7cf1a07d6a4bdd7a9a3c591690613f5414b5) Thanks [@dholms](https://github.com/dholms)! - Fix URL formatting with trailing slash

- Updated dependencies []:
  - @atproto/common@0.5.4

## 0.0.2

### Patch Changes

- [#4290](https://github.com/bluesky-social/atproto/pull/4290) [`b4a76ba`](https://github.com/bluesky-social/atproto/commit/b4a76bae7bef1189302488d43ce49a03fd61f957) Thanks [@dholms](https://github.com/dholms)! - Initial version of package

- Updated dependencies [[`b4a76ba`](https://github.com/bluesky-social/atproto/commit/b4a76bae7bef1189302488d43ce49a03fd61f957)]:
  - @atproto/ws-client@0.0.4
