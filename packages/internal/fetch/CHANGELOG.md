# @atproto-labs/fetch

## 0.3.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto-labs/pipe@0.2.1

## 0.3.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto-labs/pipe@0.2.0

## 0.2.3

### Patch Changes

- [#3821](https://github.com/bluesky-social/atproto/pull/3821) [`5050b6550`](https://github.com/bluesky-social/atproto/commit/5050b6550e07e71b0a524eda0b71b837583294d4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow `follow` redirect mode, when explicitly set.

- Updated dependencies [[`5050b6550`](https://github.com/bluesky-social/atproto/commit/5050b6550e07e71b0a524eda0b71b837583294d4)]:
  - @atproto-labs/pipe@0.1.1

## 0.2.2

### Patch Changes

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improved error response parsing

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove explicit dependency on "zod". Improved typing of `fetchJsonZodProcessor` function.

## 0.2.1

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

## 0.2.0

### Minor Changes

- [#3343](https://github.com/bluesky-social/atproto/pull/3343) [`5ece8c6ae`](https://github.com/bluesky-social/atproto/commit/5ece8c6aeab9c5c3f51295d93ed6e27c3c6095c2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix typo in `ResponseTranformer` and `fetchResponseJsonTranformer`

### Patch Changes

- [#3343](https://github.com/bluesky-social/atproto/pull/3343) [`5ece8c6ae`](https://github.com/bluesky-social/atproto/commit/5ece8c6aeab9c5c3f51295d93ed6e27c3c6095c2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Response mime type check is now case-insensitive (as per rfc2616)

## 0.1.2

### Patch Changes

- [#3135](https://github.com/bluesky-social/atproto/pull/3135) [`622654672`](https://github.com/bluesky-social/atproto/commit/6226546725d1bb0375e3c9e0d71af173e8253c4f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Support parsing of more fetch() errors

## 0.1.1

### Patch Changes

- [#2770](https://github.com/bluesky-social/atproto/pull/2770) [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose extractUrl utility

- [#2770](https://github.com/bluesky-social/atproto/pull/2770) [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add redirectCheckRequestTransform utility to prevent request redirects

- [#2770](https://github.com/bluesky-social/atproto/pull/2770) [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow customizing fetch logging function

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens

### Patch Changes

- Updated dependencies [[`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646)]:
  - @atproto-labs/pipe@0.1.0
