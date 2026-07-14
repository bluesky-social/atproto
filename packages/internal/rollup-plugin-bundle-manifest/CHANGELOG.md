# @atproto-labs/rollup-plugin-bundle-manifest

## 0.3.3

### Patch Changes

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

## 0.3.2

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

## 0.3.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

## 0.3.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

## 0.2.0

### Minor Changes

- [#3659](https://github.com/bluesky-social/atproto/pull/3659) [`371e04aad`](https://github.com/bluesky-social/atproto/commit/371e04aad2a3e8ae3fe185ce15fc8eb051cab78e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export plugin as named export

## 0.1.2

### Patch Changes

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve typing of plugin

## 0.1.1

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update NodeJS engine requirement to >=18.7.0

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens
