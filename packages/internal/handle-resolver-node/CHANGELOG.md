# @atproto-labs/handle-resolver-node

## 0.2.6

### Patch Changes

- [#5193](https://github.com/bluesky-social/atproto/pull/5193) [`ce386ee`](https://github.com/bluesky-social/atproto/commit/ce386eed324f813601db57f873fbb3b987492001) Thanks [@Rex0Lux](https://github.com/Rex0Lux)! - Add an `onError` observability option to the handle resolvers. `WellKnownHandleResolver` previously swallowed every non-abort failure and returned `null`, indistinguishable from "no `.well-known/atproto-did` endpoint exists". Passing `onError` when constructing a resolver (including `AtprotoHandleResolver` and `AtprotoHandleResolverNode`) exposes the underlying cause (SSRF blocks, 5xx upstream errors, redirects, network errors, etc.) without changing the `null` return contract. Because it is set on the instance, it also covers resolution performed internally, for example by an OAuth client the resolver is passed to.

- Updated dependencies [[`ce386ee`](https://github.com/bluesky-social/atproto/commit/ce386eed324f813601db57f873fbb3b987492001)]:
  - @atproto-labs/handle-resolver@0.4.6

## 0.2.5

### Patch Changes

- [#5197](https://github.com/bluesky-social/atproto/pull/5197) [`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite import statements to be compatible with TypeScript's `verbatimModuleSyntax` config.

- Updated dependencies [[`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f)]:
  - @atproto-labs/handle-resolver@0.4.5
  - @atproto-labs/fetch-node@0.3.5
  - @atproto/did@0.5.4

## 0.2.4

### Patch Changes

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

- Updated dependencies [[`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07)]:
  - @atproto-labs/handle-resolver@0.4.4
  - @atproto-labs/fetch-node@0.3.4
  - @atproto/did@0.5.3

## 0.2.3

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

- Updated dependencies [[`60e9b83`](https://github.com/bluesky-social/atproto/commit/60e9b8391f212c274b1f21991ee2a3a2d14f2f88), [`60e9b83`](https://github.com/bluesky-social/atproto/commit/60e9b8391f212c274b1f21991ee2a3a2d14f2f88), [`60e9b83`](https://github.com/bluesky-social/atproto/commit/60e9b8391f212c274b1f21991ee2a3a2d14f2f88), [`60e9b83`](https://github.com/bluesky-social/atproto/commit/60e9b8391f212c274b1f21991ee2a3a2d14f2f88), [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7), [`60e9b83`](https://github.com/bluesky-social/atproto/commit/60e9b8391f212c274b1f21991ee2a3a2d14f2f88)]:
  - @atproto-labs/fetch-node@0.3.3
  - @atproto/did@0.5.2
  - @atproto-labs/handle-resolver@0.4.3

## 0.2.2

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto-labs/handle-resolver@0.4.2
  - @atproto-labs/fetch-node@0.3.1
  - @atproto/did@0.5.1

## 0.2.1

### Patch Changes

- Updated dependencies [[`622d365`](https://github.com/bluesky-social/atproto/commit/622d365aeb240133f40763a3b1c43981112837fc)]:
  - @atproto/did@0.5.0
  - @atproto-labs/handle-resolver@0.4.1

## 0.2.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/did@0.4.0
  - @atproto-labs/fetch-node@0.3.0
  - @atproto-labs/handle-resolver@0.4.0

## 0.1.25

### Patch Changes

- Updated dependencies [[`d54d707`](https://github.com/bluesky-social/atproto/commit/d54d7077eb32041e1f61c312efa1dd0d768c774e), [`d54d707`](https://github.com/bluesky-social/atproto/commit/d54d7077eb32041e1f61c312efa1dd0d768c774e)]:
  - @atproto/did@0.3.0
  - @atproto-labs/handle-resolver@0.3.6

## 0.1.24

### Patch Changes

- Updated dependencies [[`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98)]:
  - @atproto/did@0.2.4
  - @atproto-labs/handle-resolver@0.3.5

## 0.1.23

### Patch Changes

- Updated dependencies [[`8012627`](https://github.com/bluesky-social/atproto/commit/8012627a1226cb2f1c753385ad2497b6b43ffd2e), [`d396de0`](https://github.com/bluesky-social/atproto/commit/d396de016d1d55d08cfad1dabd3ffd9eaeea76ea)]:
  - @atproto/did@0.2.3
  - @atproto-labs/handle-resolver@0.3.4

## 0.1.22

### Patch Changes

- Updated dependencies [[`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7)]:
  - @atproto-labs/handle-resolver@0.3.3
  - @atproto/did@0.2.2

## 0.1.21

### Patch Changes

- Updated dependencies [[`8ff5ec4ca`](https://github.com/bluesky-social/atproto/commit/8ff5ec4caa9a1f5c1e453a416ba2af22d1ee4f58)]:
  - @atproto-labs/fetch-node@0.2.0

## 0.1.20

### Patch Changes

- Updated dependencies [[`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3)]:
  - @atproto/did@0.2.1
  - @atproto-labs/handle-resolver@0.3.2

## 0.1.19

### Patch Changes

- Updated dependencies [[`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d)]:
  - @atproto/did@0.2.0
  - @atproto-labs/fetch-node@0.1.10
  - @atproto-labs/handle-resolver@0.3.1

## 0.1.18

### Patch Changes

- Updated dependencies [[`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47), [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47)]:
  - @atproto-labs/handle-resolver@0.3.0

## 0.1.17

### Patch Changes

- Updated dependencies [[`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee)]:
  - @atproto-labs/handle-resolver@0.2.0

## 0.1.16

### Patch Changes

- Updated dependencies [[`5050b6550`](https://github.com/bluesky-social/atproto/commit/5050b6550e07e71b0a524eda0b71b837583294d4), [`36dbd4155`](https://github.com/bluesky-social/atproto/commit/36dbd41551f74052a3f584719a1a7edd86eca201), [`5050b6550`](https://github.com/bluesky-social/atproto/commit/5050b6550e07e71b0a524eda0b71b837583294d4), [`43861a452`](https://github.com/bluesky-social/atproto/commit/43861a452b70268e738ef12033297cddacbe25d4)]:
  - @atproto-labs/fetch-node@0.1.9

## 0.1.15

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/handle-resolver@0.1.8

## 0.1.14

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/fetch-node@0.1.8

## 0.1.13

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update NodeJS engine requirement to >=18.7.0

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto-labs/handle-resolver@0.1.7
  - @atproto-labs/fetch-node@0.1.7
  - @atproto/did@0.1.5

## 0.1.12

### Patch Changes

- Updated dependencies [[`cc2a1222b`](https://github.com/bluesky-social/atproto/commit/cc2a1222bd2b8ddd70d70dad174c1c63246a2d87)]:
  - @atproto/did@0.1.4
  - @atproto-labs/handle-resolver@0.1.6

## 0.1.11

### Patch Changes

- Updated dependencies [[`9c0128193`](https://github.com/bluesky-social/atproto/commit/9c01281931a371304bcfa465005d7363c003bc5f)]:
  - @atproto-labs/fetch-node@0.1.6

## 0.1.10

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/fetch-node@0.1.5

## 0.1.9

### Patch Changes

- Updated dependencies [[`a200e5095`](https://github.com/bluesky-social/atproto/commit/a200e50951d297c3f9670e96027262196bc29b0b)]:
  - @atproto-labs/handle-resolver@0.1.5

## 0.1.8

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/fetch-node@0.1.4

## 0.1.7

### Patch Changes

- Updated dependencies [[`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2)]:
  - @atproto-labs/handle-resolver@0.1.4
  - @atproto/did@0.1.3

## 0.1.6

### Patch Changes

- Updated dependencies [[`80450cbf2`](https://github.com/bluesky-social/atproto/commit/80450cbf2ca27967ee9fe1a5f4bc590b26f1e6b2)]:
  - @atproto-labs/fetch-node@0.1.3

## 0.1.5

### Patch Changes

- Updated dependencies [[`8943c1008`](https://github.com/bluesky-social/atproto/commit/8943c10082702bbc0fc150237c6cc421251afd51)]:
  - @atproto-labs/fetch-node@0.1.2

## 0.1.4

### Patch Changes

- Updated dependencies [[`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3)]:
  - @atproto-labs/fetch-node@0.1.1

## 0.1.3

### Patch Changes

- Updated dependencies [[`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c), [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c), [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c)]:
  - @atproto/did@0.1.2
  - @atproto-labs/handle-resolver@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd)]:
  - @atproto-labs/handle-resolver@0.1.2
  - @atproto/did@0.1.1

## 0.1.1

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use distinct type names to prevent conflicts

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto-labs/handle-resolver@0.1.1

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens

### Patch Changes

- Updated dependencies [[`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646)]:
  - @atproto-labs/handle-resolver@0.1.0
  - @atproto-labs/fetch-node@0.1.0
  - @atproto/did@0.1.0
