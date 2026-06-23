# @atproto/bsync

## 0.0.30

### Patch Changes

- [#5117](https://github.com/bluesky-social/atproto/pull/5117) [`8a4c88b`](https://github.com/bluesky-social/atproto/commit/8a4c88b0f63fb2d82b1391d64c54e0c760fac48b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use http-terminator to close http server

## 0.0.29

### Patch Changes

- [#5086](https://github.com/bluesky-social/atproto/pull/5086) [`20665c1`](https://github.com/bluesky-social/atproto/commit/20665c18322effe648f73d70fc1a8dcc7e312992) Thanks [@devinivy](https://github.com/devinivy)! - Upgrade kysely from 0.22 to 0.29

## 0.0.28

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/common@0.6.3
  - @atproto/syntax@0.6.2

## 0.0.27

### Patch Changes

- [#4964](https://github.com/bluesky-social/atproto/pull/4964) [`571582e`](https://github.com/bluesky-social/atproto/commit/571582ea9b1aea56938b8f24daaf49e197a987ef) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove proto buf generated code from version control

- [#4960](https://github.com/bluesky-social/atproto/pull/4960) [`53b1e07`](https://github.com/bluesky-social/atproto/commit/53b1e0731ee0d13c350dd96cbcab88447eaad441) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update protobuf to add `.js` extension

- Updated dependencies [[`e6c6343`](https://github.com/bluesky-social/atproto/commit/e6c6343bd3727455bd0da12300bb4929a944e4f1)]:
  - @atproto/common@0.6.1

## 0.0.26

### Patch Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

- Updated dependencies [[`affb50c`](https://github.com/bluesky-social/atproto/commit/affb50c040b497a12631df99a6310f8e78cab557), [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/common@0.6.0
  - @atproto/syntax@0.6.0

## 0.0.25

### Patch Changes

- [#4745](https://github.com/bluesky-social/atproto/pull/4745) [`efb2b58`](https://github.com/bluesky-social/atproto/commit/efb2b58fb27a242d5308bf15916ee222daa2019b) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `delete-operations` file and new `deleteOperationsByActorAndNamespace` handler

- Updated dependencies [[`67eb0c1`](https://github.com/bluesky-social/atproto/commit/67eb0c19ac415e762e221b2ccda9f0bcf7b3dd6f)]:
  - @atproto/syntax@0.5.1

## 0.0.24

### Patch Changes

- Updated dependencies [[`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd)]:
  - @atproto/syntax@0.5.0
  - @atproto/common@0.5.14

## 0.0.23

### Patch Changes

- Updated dependencies [[`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7)]:
  - @atproto/common@0.5.0

## 0.0.22

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.4.12

## 0.0.21

### Patch Changes

- Updated dependencies [[`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d)]:
  - @atproto/syntax@0.4.1

## 0.0.20

### Patch Changes

- [#3912](https://github.com/bluesky-social/atproto/pull/3912) [`a5cd018bd`](https://github.com/bluesky-social/atproto/commit/a5cd018bd5f237221902ab1b6956b46233c92187) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Unify `getPostThreadV2` and `getPostThreadHiddenV2` responses under `app.bsky.unspecced.defs` namespace and a single interface via `threadItemPost`.

## 0.0.19

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.4.11

## 0.0.18

### Patch Changes

- Updated dependencies [[`4db923ca1`](https://github.com/bluesky-social/atproto/commit/4db923ca1c4fadd31d41c851933659e5186ee144)]:
  - @atproto/common@0.4.10

## 0.0.17

### Patch Changes

- Updated dependencies [[`bdbd3c3e3`](https://github.com/bluesky-social/atproto/commit/bdbd3c3e3f8fe8476a3fecac73810554846c938f)]:
  - @atproto/common@0.4.9

## 0.0.16

### Patch Changes

- Updated dependencies [[`670b6b5de`](https://github.com/bluesky-social/atproto/commit/670b6b5de2bf91e6944761c98eb1126fb6a681ee)]:
  - @atproto/syntax@0.4.0

## 0.0.15

### Patch Changes

- Updated dependencies [[`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29)]:
  - @atproto/syntax@0.3.4

## 0.0.14

### Patch Changes

- Updated dependencies [[`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c)]:
  - @atproto/syntax@0.3.3

## 0.0.13

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update NodeJS engine requirement to >=18.7.0

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto/common@0.4.8
  - @atproto/syntax@0.3.2

## 0.0.12

### Patch Changes

- Updated dependencies [[`52c687a05`](https://github.com/bluesky-social/atproto/commit/52c687a05c70d5660fae1de9e1bbc6297f37f1f4)]:
  - @atproto/common@0.4.7

## 0.0.11

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.4.6

## 0.0.10

### Patch Changes

- Updated dependencies [[`588baae12`](https://github.com/bluesky-social/atproto/commit/588baae1212a3cba3bf0d95d2f268e80513fd9c4)]:
  - @atproto/common@0.4.5

## 0.0.9

### Patch Changes

- Updated dependencies [[`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d)]:
  - @atproto/syntax@0.3.1

## 0.0.8

### Patch Changes

- Updated dependencies [[`4098d9890`](https://github.com/bluesky-social/atproto/commit/4098d9890173f4d6c6512f2d8994eebbf12b5e13)]:
  - @atproto/common@0.4.4

## 0.0.7

### Patch Changes

- Updated dependencies [[`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3)]:
  - @atproto/common@0.4.3

## 0.0.6

### Patch Changes

- Updated dependencies [[`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93)]:
  - @atproto/common@0.4.2

## 0.0.5

### Patch Changes

- [#2648](https://github.com/bluesky-social/atproto/pull/2648) [`76c91f832`](https://github.com/bluesky-social/atproto/commit/76c91f8325363c95e25349e8e236aa2f70e63d5b) Thanks [@dholms](https://github.com/dholms)! - Support for priority notifications

## 0.0.4

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Obfuscate request headers in logs using utils from @atproto/common

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto/common@0.4.1

## 0.0.3

### Patch Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/common@0.4.0
  - @atproto/syntax@0.3.0

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.3.4
  - @atproto/syntax@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [[`0c815b964`](https://github.com/bluesky-social/atproto/commit/0c815b964c030aa0f277c40bf9786f130dc320f4)]:
  - @atproto/syntax@0.2.0
