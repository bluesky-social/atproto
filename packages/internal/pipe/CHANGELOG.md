# @atproto-labs/pipe

## 0.2.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

## 0.2.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

## 0.1.1

### Patch Changes

- [#3821](https://github.com/bluesky-social/atproto/pull/3821) [`5050b6550`](https://github.com/bluesky-social/atproto/commit/5050b6550e07e71b0a524eda0b71b837583294d4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow first pipeline function to have more than one argument

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens
