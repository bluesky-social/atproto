# @atproto/ws-client

## 0.1.2

### Patch Changes

- [#5117](https://github.com/bluesky-social/atproto/pull/5117) [`8a4c88b`](https://github.com/bluesky-social/atproto/commit/8a4c88b0f63fb2d82b1391d64c54e0c760fac48b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make tests less flaky in CI

## 0.1.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/common@0.6.3

## 0.1.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`affb50c`](https://github.com/bluesky-social/atproto/commit/affb50c040b497a12631df99a6310f8e78cab557), [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/common@0.6.0

## 0.0.4

### Patch Changes

- [#4290](https://github.com/bluesky-social/atproto/pull/4290) [`b4a76ba`](https://github.com/bluesky-social/atproto/commit/b4a76bae7bef1189302488d43ce49a03fd61f957) Thanks [@dholms](https://github.com/dholms)! - Support sending data on websocket as well as an onReconnect callback

## 0.0.3

### Patch Changes

- Updated dependencies [[`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7), [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7)]:
  - @atproto/common@0.5.0

## 0.0.2

### Patch Changes

- [#4348](https://github.com/bluesky-social/atproto/pull/4348) [`1dd20d3a8`](https://github.com/bluesky-social/atproto/commit/1dd20d3a81cda29392d8d63d13082254ec5f68a8) Thanks [@dholms](https://github.com/dholms)! - Move WebSocketKeepAlive into its own package
