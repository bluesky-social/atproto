# @atproto/oauth-client-expo

## 0.1.8

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.7.11
  - @atproto/oauth-client-browser@0.4.9

## 0.1.7

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.7.10
  - @atproto/oauth-client-browser@0.4.8

## 0.1.6

### Patch Changes

- [#5197](https://github.com/bluesky-social/atproto/pull/5197) [`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite import statements to be compatible with TypeScript's `verbatimModuleSyntax` config.

- Updated dependencies [[`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f)]:
  - @atproto/oauth-client-browser@0.4.7
  - @atproto-labs/simple-store@0.4.4
  - @atproto/oauth-client@0.7.9

## 0.1.5

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.7.8
  - @atproto/oauth-client-browser@0.4.6

## 0.1.4

### Patch Changes

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

- Updated dependencies [[`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07)]:
  - @atproto/oauth-client-browser@0.4.5
  - @atproto-labs/simple-store@0.4.3
  - @atproto/oauth-client@0.7.7

## 0.1.3

### Patch Changes

- Updated dependencies [[`8bcba69`](https://github.com/bluesky-social/atproto/commit/8bcba69cf1f02d09e07b51ce091918312029df63)]:
  - @atproto/oauth-client@0.7.6
  - @atproto/oauth-client-browser@0.4.4

## 0.1.2

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

- Updated dependencies [[`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7)]:
  - @atproto-labs/simple-store@0.4.2
  - @atproto/oauth-client@0.7.5
  - @atproto/oauth-client-browser@0.4.3

## 0.1.1

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/oauth-client-browser@0.4.2
  - @atproto-labs/simple-store@0.4.1
  - @atproto/oauth-client@0.7.3

## 0.1.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`affb50c`](https://github.com/bluesky-social/atproto/commit/affb50c040b497a12631df99a6310f8e78cab557), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/oauth-client@0.7.0
  - @atproto/oauth-client-browser@0.4.0
  - @atproto-labs/simple-store@0.4.0

## 0.0.10

### Patch Changes

- [#4642](https://github.com/bluesky-social/atproto/pull/4642) [`a23d132`](https://github.com/bluesky-social/atproto/commit/a23d13268ccfd51a54d21256469b8cb43f7b07df) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove dependency on `event-target-polyfill`

- Updated dependencies [[`a23d132`](https://github.com/bluesky-social/atproto/commit/a23d13268ccfd51a54d21256469b8cb43f7b07df), [`a23d132`](https://github.com/bluesky-social/atproto/commit/a23d13268ccfd51a54d21256469b8cb43f7b07df), [`a23d132`](https://github.com/bluesky-social/atproto/commit/a23d13268ccfd51a54d21256469b8cb43f7b07df), [`a23d132`](https://github.com/bluesky-social/atproto/commit/a23d13268ccfd51a54d21256469b8cb43f7b07df), [`a23d132`](https://github.com/bluesky-social/atproto/commit/a23d13268ccfd51a54d21256469b8cb43f7b07df)]:
  - @atproto/oauth-client@0.6.0
  - @atproto/oauth-client-browser@0.3.41

## 0.0.9

### Patch Changes

- [#4606](https://github.com/bluesky-social/atproto/pull/4606) [`78fee14`](https://github.com/bluesky-social/atproto/commit/78fee144ff46ffc4585f318c72eea98e4357ba7b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add iOS specific options on authentication web-view

- [#4606](https://github.com/bluesky-social/atproto/pull/4606) [`78fee14`](https://github.com/bluesky-social/atproto/commit/78fee144ff46ffc4585f318c72eea98e4357ba7b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove dev logs

## 0.0.8

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.5.14
  - @atproto/oauth-client-browser@0.3.40

## 0.0.7

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.5.13
  - @atproto/oauth-client-browser@0.3.39

## 0.0.6

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.5.12
  - @atproto/oauth-client-browser@0.3.38

## 0.0.5

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.5.11
  - @atproto/oauth-client-browser@0.3.37

## 0.0.4

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.5.10
  - @atproto/oauth-client-browser@0.3.36

## 0.0.3

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-client@0.5.9
  - @atproto/oauth-client-browser@0.3.35

## 0.0.2

### Patch Changes

- [#4289](https://github.com/bluesky-social/atproto/pull/4289) [`8ff5ec4ca`](https://github.com/bluesky-social/atproto/commit/8ff5ec4caa9a1f5c1e453a416ba2af22d1ee4f58) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The package now re-exports everything from `@atproto/oauth-client`, avoiding the need to explicitly depend on it.

- [#4300](https://github.com/bluesky-social/atproto/pull/4300) [`1a7bd8c0d`](https://github.com/bluesky-social/atproto/commit/1a7bd8c0d2a5dad5cd035a82f54655470172203d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `abortcontroller-polyfill` that was causing "Property 'DOMException' doesn't exist" errors

- [#4300](https://github.com/bluesky-social/atproto/pull/4300) [`1a7bd8c0d`](https://github.com/bluesky-social/atproto/commit/1a7bd8c0d2a5dad5cd035a82f54655470172203d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Polyfill `core-js/proposals/explicit-resource-management` for web

- Updated dependencies []:
  - @atproto/oauth-client@0.5.8
  - @atproto/oauth-client-browser@0.3.34

## 0.0.1

### Patch Changes

- [#4220](https://github.com/bluesky-social/atproto/pull/4220) [`fefe70126`](https://github.com/bluesky-social/atproto/commit/fefe70126d0ea82507ac750f669b3478290f186b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - OAuthClient SDK for Expo

- Updated dependencies [[`fefe70126`](https://github.com/bluesky-social/atproto/commit/fefe70126d0ea82507ac750f669b3478290f186b), [`fefe70126`](https://github.com/bluesky-social/atproto/commit/fefe70126d0ea82507ac750f669b3478290f186b), [`fefe70126`](https://github.com/bluesky-social/atproto/commit/fefe70126d0ea82507ac750f669b3478290f186b), [`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3)]:
  - @atproto/oauth-client-browser@0.3.33
  - @atproto/oauth-client@0.5.7
