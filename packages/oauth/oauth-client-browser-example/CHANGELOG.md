# @atproto/oauth-client-browser-example

## 0.1.5

### Patch Changes

- [#5197](https://github.com/bluesky-social/atproto/pull/5197) [`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite import statements to be compatible with TypeScript's `verbatimModuleSyntax` config.

## 0.1.4

### Patch Changes

- [#5158](https://github.com/bluesky-social/atproto/pull/5158) [`963b944`](https://github.com/bluesky-social/atproto/commit/963b9440190c7e59abc0c05de70ecea9cab6fe37) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve dark mode support

- [#5158](https://github.com/bluesky-social/atproto/pull/5158) [`963b944`](https://github.com/bluesky-social/atproto/commit/963b9440190c7e59abc0c05de70ecea9cab6fe37) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export pdsClient in console

- [#5158](https://github.com/bluesky-social/atproto/pull/5158) [`963b944`](https://github.com/bluesky-social/atproto/commit/963b9440190c7e59abc0c05de70ecea9cab6fe37) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve bskyClient preferences setup (avoid infinite error loop)

- [#5158](https://github.com/bluesky-social/atproto/pull/5158) [`963b944`](https://github.com/bluesky-social/atproto/commit/963b9440190c7e59abc0c05de70ecea9cab6fe37) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add account manager link in user menu

## 0.1.3

### Patch Changes

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Convert source from CJS to ESM

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly type the `default` export

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `start` function from `/server` export

## 0.1.2

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

## 0.1.1

### Patch Changes

- [#4980](https://github.com/bluesky-social/atproto/pull/4980) [`482767c`](https://github.com/bluesky-social/atproto/commit/482767c4bcce95aa390b2992b028fd8e27d162b2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve bundle size

## 0.1.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

## 0.0.10

### Patch Changes

- [#4586](https://github.com/bluesky-social/atproto/pull/4586) [`b619ae8`](https://github.com/bluesky-social/atproto/commit/b619ae87a8aff8f0db7785b26b0a3602d6ef6149) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Avoid using the app with an invalid scope that prevents the labelers to be set

## 0.0.9

### Patch Changes

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose bskyClient instance and lexicons on window object

- [#4461](https://github.com/bluesky-social/atproto/pull/4461) [`5d8e7a6`](https://github.com/bluesky-social/atproto/commit/5d8e7a6588fc9e57e15d83d47bb45103205e3e41) Thanks [@ThisIsMissEm](https://github.com/ThisIsMissEm)! - Add support for signup (prompt=create)

- [#4467](https://github.com/bluesky-social/atproto/pull/4467) [`a78380c`](https://github.com/bluesky-social/atproto/commit/a78380c89cb47c348e77eadb0738e7cb1c867a69) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Minor ui tweak

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite `getSession` and `getRecord` using generic hooks

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add bin script, allowing to run through npx

## 0.0.8

### Patch Changes

- [#4319](https://github.com/bluesky-social/atproto/pull/4319) [`3202dce91`](https://github.com/bluesky-social/atproto/commit/3202dce91b31daa065769b6387c6b199f515671a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update example app

## 0.0.7

### Patch Changes

- [#4311](https://github.com/bluesky-social/atproto/pull/4311) [`d764c54fe`](https://github.com/bluesky-social/atproto/commit/d764c54fe4ffaccb9ed9580c153373fc6e12f803) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Minor improvements

## 0.0.6

### Patch Changes

- [`f4cb3e4d0`](https://github.com/bluesky-social/atproto/commit/f4cb3e4d0ac45e567fa14f79b99a84621fa89a56) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update default scopes

## 0.0.5

### Patch Changes

- [#3952](https://github.com/bluesky-social/atproto/pull/3952) [`09d90ae48`](https://github.com/bluesky-social/atproto/commit/09d90ae486c451512e72c098228de3f3dd058101) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve UI

## 0.0.4

### Patch Changes

- [#3820](https://github.com/bluesky-social/atproto/pull/3820) [`8318c5718`](https://github.com/bluesky-social/atproto/commit/8318c57187a1fed443be73bfd7639f49febc7337) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `com.atproto.server.getSession` query.

- [#3820](https://github.com/bluesky-social/atproto/pull/3820) [`8318c5718`](https://github.com/bluesky-social/atproto/commit/8318c57187a1fed443be73bfd7639f49febc7337) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow configuration of loopback client id scope through query param

## 0.0.3

### Patch Changes

- [#3797](https://github.com/bluesky-social/atproto/pull/3797) [`a48b093f0`](https://github.com/bluesky-social/atproto/commit/a48b093f0ba3cf67b7abc50d309afcb336d8ead8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose `pdsAgent` as global constant

## 0.0.2

### Patch Changes

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update react to version 19

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build using SWC

## 0.0.1

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order
