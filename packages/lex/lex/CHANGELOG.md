# @atproto/lex

## 0.1.4

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/lex-installer@0.1.1
  - @atproto/lex-builder@0.1.3
  - @atproto/lex-client@0.1.4
  - @atproto/lex-schema@0.1.4
  - @atproto/lex-data@0.1.2
  - @atproto/lex-json@0.1.1

## 0.1.3

### Patch Changes

- [#5006](https://github.com/bluesky-social/atproto/pull/5006) [`60721e6`](https://github.com/bluesky-social/atproto/commit/60721e69c8db193eb817c4238ac447505ac855bc) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix README

- [#5006](https://github.com/bluesky-social/atproto/pull/5006) [`60721e6`](https://github.com/bluesky-social/atproto/commit/60721e69c8db193eb817c4238ac447505ac855bc) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update `yargs` depedency

- Updated dependencies [[`60721e6`](https://github.com/bluesky-social/atproto/commit/60721e69c8db193eb817c4238ac447505ac855bc), [`60721e6`](https://github.com/bluesky-social/atproto/commit/60721e69c8db193eb817c4238ac447505ac855bc)]:
  - @atproto/lex-schema@0.1.2
  - @atproto/lex-client@0.1.3

## 0.1.2

### Patch Changes

- [#4984](https://github.com/bluesky-social/atproto/pull/4984) [`5bdb4ad`](https://github.com/bluesky-social/atproto/commit/5bdb4addd6a3798bf6c8c391c74044b3e251008a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `default` export of "main" schema in the namespace file

- [#4979](https://github.com/bluesky-social/atproto/pull/4979) [`314df62`](https://github.com/bluesky-social/atproto/commit/314df62537bb519231aa375dd3a38360afc79ce0) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Always add `#__PURE__` annotations to function calls

- [#4983](https://github.com/bluesky-social/atproto/pull/4983) [`1259646`](https://github.com/bluesky-social/atproto/commit/125964673962a86282a05bf22f410fad8ad06b41) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make the generation of the `$defs` namespace optional by default

- Updated dependencies [[`3aae4fe`](https://github.com/bluesky-social/atproto/commit/3aae4fe43448dca860fc6c4a24d18bfa64de084b), [`5bdb4ad`](https://github.com/bluesky-social/atproto/commit/5bdb4addd6a3798bf6c8c391c74044b3e251008a), [`3aae4fe`](https://github.com/bluesky-social/atproto/commit/3aae4fe43448dca860fc6c4a24d18bfa64de084b), [`314df62`](https://github.com/bluesky-social/atproto/commit/314df62537bb519231aa375dd3a38360afc79ce0), [`1259646`](https://github.com/bluesky-social/atproto/commit/125964673962a86282a05bf22f410fad8ad06b41), [`482767c`](https://github.com/bluesky-social/atproto/commit/482767c4bcce95aa390b2992b028fd8e27d162b2)]:
  - @atproto/lex-builder@0.1.2
  - @atproto/lex-client@0.1.2

## 0.1.1

### Patch Changes

- [#4895](https://github.com/bluesky-social/atproto/pull/4895) [`25e0233`](https://github.com/bluesky-social/atproto/commit/25e02339a383740e762c9a9633a701d2fb0cab86) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `applyWrites()` method to Lex SDK client class

  Thank you [@TrySound](https://github.com/TrySound) for the suggestion

- Updated dependencies [[`e6c6343`](https://github.com/bluesky-social/atproto/commit/e6c6343bd3727455bd0da12300bb4929a944e4f1), [`e6c6343`](https://github.com/bluesky-social/atproto/commit/e6c6343bd3727455bd0da12300bb4929a944e4f1), [`fb1b403`](https://github.com/bluesky-social/atproto/commit/fb1b40350d46f3c49e512b7e24b071b03902e3b8), [`25e0233`](https://github.com/bluesky-social/atproto/commit/25e02339a383740e762c9a9633a701d2fb0cab86)]:
  - @atproto/lex-client@0.1.1
  - @atproto/lex-data@0.1.1
  - @atproto/lex-builder@0.1.1

## 0.1.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`affb50c`](https://github.com/bluesky-social/atproto/commit/affb50c040b497a12631df99a6310f8e78cab557), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/lex-builder@0.1.0
  - @atproto/lex-client@0.1.0
  - @atproto/lex-data@0.1.0
  - @atproto/lex-installer@0.1.0
  - @atproto/lex-json@0.1.0
  - @atproto/lex-schema@0.1.0

## 0.0.27

### Patch Changes

- Updated dependencies [[`d8b2374`](https://github.com/bluesky-social/atproto/commit/d8b2374e1592d1dec65a33439791bc141f02397a)]:
  - @atproto/lex-client@0.0.22
  - @atproto/lex-installer@0.0.27

## 0.0.26

### Patch Changes

- Updated dependencies [[`2fd8d62`](https://github.com/bluesky-social/atproto/commit/2fd8d62708dc23de6ed21cbcccfebab68b19f588), [`907edfa`](https://github.com/bluesky-social/atproto/commit/907edfa1d16b1074bab4dc617d0bd1a810f3da02)]:
  - @atproto/lex-schema@0.0.20
  - @atproto/lex-client@0.0.21
  - @atproto/lex-builder@0.0.23
  - @atproto/lex-installer@0.0.26

## 0.0.25

### Patch Changes

- Updated dependencies [[`61e75af`](https://github.com/bluesky-social/atproto/commit/61e75af39e63217d915850b2f8ac8db5f92eed0b), [`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676), [`952354c`](https://github.com/bluesky-social/atproto/commit/952354c1dd458251f8b643d02f4b227d40c5df17)]:
  - @atproto/lex-client@0.0.20
  - @atproto/lex-schema@0.0.19
  - @atproto/lex-json@0.0.16
  - @atproto/lex-builder@0.0.22
  - @atproto/lex-installer@0.0.25

## 0.0.24

### Patch Changes

- [#4828](https://github.com/bluesky-social/atproto/pull/4828) [`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Accept legacy blob references in non-strict mode. Legacy blob references (objects with `cid` and `mimeType` properties) are now accepted when `strict: false`, which is the default behavior when `strictResponseProcessing` is disabled on the Client.

  BREAKING: The `allowLegacy` option has been removed from the blob schema builder, and legacy blobs are now handled automatically based on the strictness mode: in strict mode they are rejected, and in non-strict mode they are accepted. Consumers should stop passing `allowLegacy` and rely on strictness configuration instead. Likewise, CLI consumers should stop using the removed `--allowLegacyBlobs` flag and use the default strict/non-strict behavior.

- Updated dependencies [[`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856), [`f6f100c`](https://github.com/bluesky-social/atproto/commit/f6f100c33700a7ff58a1458109cc7420131feed0), [`b6b231f`](https://github.com/bluesky-social/atproto/commit/b6b231f9c05cf90239d4a29aa0ae2592ea5ce928), [`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856), [`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856), [`f6f100c`](https://github.com/bluesky-social/atproto/commit/f6f100c33700a7ff58a1458109cc7420131feed0), [`f6f100c`](https://github.com/bluesky-social/atproto/commit/f6f100c33700a7ff58a1458109cc7420131feed0)]:
  - @atproto/lex-data@0.0.15
  - @atproto/lex-client@0.0.19
  - @atproto/lex-schema@0.0.18
  - @atproto/lex-json@0.0.15
  - @atproto/lex-installer@0.0.24
  - @atproto/lex-builder@0.0.21

## 0.0.23

### Patch Changes

- Updated dependencies [[`527f5d4`](https://github.com/bluesky-social/atproto/commit/527f5d4c5d0c9264c2ff6f23ad06a41163fc6809), [`527f5d4`](https://github.com/bluesky-social/atproto/commit/527f5d4c5d0c9264c2ff6f23ad06a41163fc6809), [`c4df84c`](https://github.com/bluesky-social/atproto/commit/c4df84cd78df68ee8cb7289e7b61b3a032ad484e), [`527f5d4`](https://github.com/bluesky-social/atproto/commit/527f5d4c5d0c9264c2ff6f23ad06a41163fc6809), [`a99dd58`](https://github.com/bluesky-social/atproto/commit/a99dd58b5fe1995e571cf5e7b0105355583efa93), [`e5e5bcf`](https://github.com/bluesky-social/atproto/commit/e5e5bcf85fbc0d418f05724d684e7265be6a0be9), [`ac6bd18`](https://github.com/bluesky-social/atproto/commit/ac6bd18f1dc3397dd29008eff2a1e40702a4e138), [`c5c6c7d`](https://github.com/bluesky-social/atproto/commit/c5c6c7dac3b08e5f63cc918f57705573028ad797)]:
  - @atproto/lex-schema@0.0.17
  - @atproto/lex-client@0.0.18
  - @atproto/lex-builder@0.0.20
  - @atproto/lex-installer@0.0.23

## 0.0.22

### Patch Changes

- Updated dependencies [[`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786), [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786), [`df8328c`](https://github.com/bluesky-social/atproto/commit/df8328c3c2f211fe16ccf58fa9f3968465cbf2b0), [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786), [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786), [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786)]:
  - @atproto/lex-client@0.0.17
  - @atproto/lex-schema@0.0.16
  - @atproto/lex-data@0.0.14
  - @atproto/lex-builder@0.0.19
  - @atproto/lex-installer@0.0.22
  - @atproto/lex-json@0.0.14

## 0.0.21

### Patch Changes

- Updated dependencies [[`5a2f884`](https://github.com/bluesky-social/atproto/commit/5a2f8847efd91252971fa243d21bd52ada7aa8f4), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`112b159`](https://github.com/bluesky-social/atproto/commit/112b159ec293a5c3fff41237474a3788fc47f9ca), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe)]:
  - @atproto/lex-client@0.0.16
  - @atproto/lex-schema@0.0.15
  - @atproto/lex-builder@0.0.18
  - @atproto/lex-installer@0.0.21

## 0.0.20

### Patch Changes

- [#4689](https://github.com/bluesky-social/atproto/pull/4689) [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update readme

- Updated dependencies [[`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7)]:
  - @atproto/lex-schema@0.0.14
  - @atproto/lex-data@0.0.13
  - @atproto/lex-client@0.0.15
  - @atproto/lex-installer@0.0.20
  - @atproto/lex-builder@0.0.17
  - @atproto/lex-json@0.0.13

## 0.0.19

### Patch Changes

- [#4672](https://github.com/bluesky-social/atproto/pull/4672) [`38852f0`](https://github.com/bluesky-social/atproto/commit/38852f0ddfa9fbce8036233dc6af87614e9ae4b2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve readme

- Updated dependencies [[`38852f0`](https://github.com/bluesky-social/atproto/commit/38852f0ddfa9fbce8036233dc6af87614e9ae4b2)]:
  - @atproto/lex-client@0.0.14
  - @atproto/lex-installer@0.0.19

## 0.0.18

### Patch Changes

- Updated dependencies []:
  - @atproto/lex-client@0.0.13
  - @atproto/lex-installer@0.0.18

## 0.0.17

### Patch Changes

- [#4639](https://github.com/bluesky-social/atproto/pull/4639) [`009c4af`](https://github.com/bluesky-social/atproto/commit/009c4afd3643d4edf4bd05065ec93cab74610bfe) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add test cases for `knownValues` strings

- Updated dependencies [[`39dea03`](https://github.com/bluesky-social/atproto/commit/39dea03c417a1da069962560505427a7aa25ad7a), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`39dea03`](https://github.com/bluesky-social/atproto/commit/39dea03c417a1da069962560505427a7aa25ad7a), [`39dea03`](https://github.com/bluesky-social/atproto/commit/39dea03c417a1da069962560505427a7aa25ad7a), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`39dea03`](https://github.com/bluesky-social/atproto/commit/39dea03c417a1da069962560505427a7aa25ad7a), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`cd9deb6`](https://github.com/bluesky-social/atproto/commit/cd9deb6f210b91661595398cb2ef70bc40eccabe), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df)]:
  - @atproto/lex-schema@0.0.13
  - @atproto/lex-builder@0.0.16
  - @atproto/lex-data@0.0.12
  - @atproto/lex-client@0.0.13
  - @atproto/lex-installer@0.0.17
  - @atproto/lex-json@0.0.12

## 0.0.16

### Patch Changes

- Updated dependencies [[`619068f`](https://github.com/bluesky-social/atproto/commit/619068fb81203b3b43b632892bdcb0a5067f7fe4)]:
  - @atproto/lex-builder@0.0.15
  - @atproto/lex-client@0.0.12
  - @atproto/lex-installer@0.0.16

## 0.0.15

### Patch Changes

- [#4601](https://github.com/bluesky-social/atproto/pull/4601) [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix `exports` field in package.json

- [#4601](https://github.com/bluesky-social/atproto/pull/4601) [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add JSDoc

- [#4601](https://github.com/bluesky-social/atproto/pull/4601) [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update README

- Updated dependencies [[`7b9a98a`](https://github.com/bluesky-social/atproto/commit/7b9a98a763636c5f66a06da11fe6013f29dd9157), [`7b9a98a`](https://github.com/bluesky-social/atproto/commit/7b9a98a763636c5f66a06da11fe6013f29dd9157), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`7b9a98a`](https://github.com/bluesky-social/atproto/commit/7b9a98a763636c5f66a06da11fe6013f29dd9157), [`7b9a98a`](https://github.com/bluesky-social/atproto/commit/7b9a98a763636c5f66a06da11fe6013f29dd9157), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015)]:
  - @atproto/lex-schema@0.0.12
  - @atproto/lex-client@0.0.12
  - @atproto/lex-json@0.0.11
  - @atproto/lex-installer@0.0.15
  - @atproto/lex-data@0.0.11
  - @atproto/lex-builder@0.0.14

## 0.0.14

### Patch Changes

- [#4589](https://github.com/bluesky-social/atproto/pull/4589) [`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to set default `headers` when creating XRPC agent

- Updated dependencies [[`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a), [`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a), [`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a), [`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a)]:
  - @atproto/lex-client@0.0.11
  - @atproto/lex-data@0.0.10
  - @atproto/lex-installer@0.0.14
  - @atproto/lex-json@0.0.10
  - @atproto/lex-schema@0.0.11
  - @atproto/lex-builder@0.0.13

## 0.0.13

### Patch Changes

- Updated dependencies []:
  - @atproto/lex-installer@0.0.13

## 0.0.12

### Patch Changes

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `TypedObject` to `Unknown$TypedObject`

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix inability to assign (object containing) open union results to `LexMap` type

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add new `Unknown$Type` type to represent records an object's unknown `$type` property (typically from open unions).

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `UnknownObjectOutput` to `UnknownObject`

- Updated dependencies [[`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`aaedafc`](https://github.com/bluesky-social/atproto/commit/aaedafc6baef106b85e0954d8474cec21c00c1c2), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b)]:
  - @atproto/lex-schema@0.0.10
  - @atproto/lex-client@0.0.10
  - @atproto/lex-json@0.0.9
  - @atproto/lex-data@0.0.9
  - @atproto/lex-builder@0.0.12
  - @atproto/lex-installer@0.0.12

## 0.0.11

### Patch Changes

- Updated dependencies [[`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e)]:
  - @atproto/lex-data@0.0.8
  - @atproto/lex-client@0.0.9
  - @atproto/lex-installer@0.0.11
  - @atproto/lex-json@0.0.8
  - @atproto/lex-schema@0.0.9
  - @atproto/lex-builder@0.0.11

## 0.0.10

### Patch Changes

- Updated dependencies [[`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe)]:
  - @atproto/lex-data@0.0.7
  - @atproto/lex-schema@0.0.8
  - @atproto/lex-builder@0.0.10
  - @atproto/lex-client@0.0.8
  - @atproto/lex-installer@0.0.10
  - @atproto/lex-json@0.0.7

## 0.0.9

### Patch Changes

- [#4501](https://github.com/bluesky-social/atproto/pull/4501) [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add an `indexFile` option that allows generating an "index.ts" file that re-exports every tld namespaces.

- [#4501](https://github.com/bluesky-social/atproto/pull/4501) [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export everything from `@atproto/lex-data` and `@atproto/lex-json`

- Updated dependencies [[`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98)]:
  - @atproto/lex-builder@0.0.9
  - @atproto/lex-client@0.0.7
  - @atproto/lex-data@0.0.6
  - @atproto/lex-schema@0.0.7
  - @atproto/lex-installer@0.0.9
  - @atproto/lex-json@0.0.6

## 0.0.8

### Patch Changes

- Updated dependencies [[`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c)]:
  - @atproto/lex-schema@0.0.6
  - @atproto/lex-builder@0.0.8
  - @atproto/lex-client@0.0.6
  - @atproto/lex-installer@0.0.8

## 0.0.7

### Patch Changes

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix `main` export in `package.json`

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Re-expect everything from `@atproto/lex-client`

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Re-export everything from `@atproto/lex-schema`

- Updated dependencies [[`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece)]:
  - @atproto/lex-client@0.0.5
  - @atproto/lex-schema@0.0.5
  - @atproto/lex-builder@0.0.7
  - @atproto/lex-installer@0.0.7

## 0.0.6

### Patch Changes

- Updated dependencies [[`e39ca11`](https://github.com/bluesky-social/atproto/commit/e39ca114accac65070dcdd424a181821aad6d99d)]:
  - @atproto/lex-builder@0.0.6
  - @atproto/lex-client@0.0.4
  - @atproto/lex-installer@0.0.6
  - @atproto/lex-schema@0.0.4

## 0.0.5

### Patch Changes

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rework object validation logic to work without `options` argument

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace use of `CID` with `Cid`

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename schema methods `validate`, `check` and `maybe` to `safeParse`, `matches` and `ifMatches` respectively.

- [#4397](https://github.com/bluesky-social/atproto/pull/4397) [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `CHANGELOG.md` to npm package

- [#4398](https://github.com/bluesky-social/atproto/pull/4398) [`a17d2e8`](https://github.com/bluesky-social/atproto/commit/a17d2e8a59ceb00fa8197642e0767fcc776d5b70) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `ignoreInvalidLexicons` option when building lexicon schemas

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `default` option to `const` and `enum` schemas

- Updated dependencies [[`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`2d13d05`](https://github.com/bluesky-social/atproto/commit/2d13d05ab06576703742b1b638d2f243b6b2915f), [`d396de0`](https://github.com/bluesky-social/atproto/commit/d396de016d1d55d08cfad1dabd3ffd9eaeea76ea), [`0f2fc65`](https://github.com/bluesky-social/atproto/commit/0f2fc6592f0c89d26ac7a2ef70b12cbd15a18d05), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`9f87ff3`](https://github.com/bluesky-social/atproto/commit/9f87ff3aa60090c8c38b6ce400cba6ceff5cd2e9), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4), [`a17d2e8`](https://github.com/bluesky-social/atproto/commit/a17d2e8a59ceb00fa8197642e0767fcc776d5b70), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba)]:
  - @atproto/lex-schema@0.0.3
  - @atproto/lex-installer@0.0.5
  - @atproto/lex-builder@0.0.5
  - @atproto/lex-client@0.0.3

## 0.0.4

### Patch Changes

- [#4380](https://github.com/bluesky-social/atproto/pull/4380) [`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix description of `--allowLegacyBlobs` argument

- [#4380](https://github.com/bluesky-social/atproto/pull/4380) [`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `--build`/`--no-build` argument from the `install` command

- [#4380](https://github.com/bluesky-social/atproto/pull/4380) [`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to configure file extenstion and import file extension in `lex build`

- Updated dependencies [[`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4), [`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4), [`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4)]:
  - @atproto/lex-schema@0.0.2
  - @atproto/lex-builder@0.0.4
  - @atproto/lex-installer@0.0.4
  - @atproto/lex-client@0.0.2

## 0.0.3

### Patch Changes

- [#4374](https://github.com/bluesky-social/atproto/pull/4374) [`5ffd612`](https://github.com/bluesky-social/atproto/commit/5ffd6129909071e979c30f31266119865ab582b6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add missing files from package.json

- Updated dependencies []:
  - @atproto/lex-builder@0.0.3
  - @atproto/lex-installer@0.0.3
  - @atproto/lex-client@0.0.1

## 0.0.2

### Patch Changes

- [#4372](https://github.com/bluesky-social/atproto/pull/4372) [`7456f53`](https://github.com/bluesky-social/atproto/commit/7456f53e45fb3eef2f3bbdf2513da2d8ab078d80) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix error when running `install` command

- Updated dependencies [[`7456f53`](https://github.com/bluesky-social/atproto/commit/7456f53e45fb3eef2f3bbdf2513da2d8ab078d80)]:
  - @atproto/lex-builder@0.0.2
  - @atproto/lex-client@0.0.1
  - @atproto/lex-installer@0.0.2

## 0.0.1

### Patch Changes

- [#4371](https://github.com/bluesky-social/atproto/pull/4371) [`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Release

- Updated dependencies [[`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af)]:
  - @atproto/lex-builder@0.0.1
  - @atproto/lex-client@0.0.1
  - @atproto/lex-installer@0.0.1
  - @atproto/lex-schema@0.0.1
