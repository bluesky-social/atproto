# @atproto/oauth-provider-api

## 0.7.0

### Minor Changes

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update `Account` properties to contain strongly typed `did`

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update interfaces to use did instead of sub

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to deactivate and delete account from the account manager interface

### Patch Changes

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove unused `consentRequired` logic from OAuth consent flow UI

## 0.6.2

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- Updated dependencies [[`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5)]:
  - @atproto/oauth-types@0.7.2
  - @atproto/jwk@0.7.1

## 0.6.1

### Patch Changes

- [#4986](https://github.com/bluesky-social/atproto/pull/4986) [`6c63f7d`](https://github.com/bluesky-social/atproto/commit/6c63f7dca6d37c22a8dd5d579ad6a72e532fc372) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to change the user handle through the account manager interface

## 0.6.0

### Minor Changes

- [#4883](https://github.com/bluesky-social/atproto/pull/4883) [`64f5148`](https://github.com/bluesky-social/atproto/commit/64f5148ad8dcd669f77a9e022bd2622b2e594e0d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for email verification and management in the account management interface

## 0.5.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

### Patch Changes

- Updated dependencies [[`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c), [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9), [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705)]:
  - @atproto/jwk@0.7.0
  - @atproto/oauth-types@0.7.0

## 0.4.0

### Minor Changes

- [#4820](https://github.com/bluesky-social/atproto/pull/4820) [`b3ce11a`](https://github.com/bluesky-social/atproto/commit/b3ce11ae2e965f239db6aec6054f069d557f4d55) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Unify account management and authorization pages into a signle package

### Patch Changes

- [#4820](https://github.com/bluesky-social/atproto/pull/4820) [`b3ce11a`](https://github.com/bluesky-social/atproto/commit/b3ce11ae2e965f239db6aec6054f069d557f4d55) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Account management interface improvements

## 0.3.7

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-types@0.6.2

## 0.3.6

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-types@0.6.1

## 0.3.5

### Patch Changes

- Updated dependencies [[`95ef3c2`](https://github.com/bluesky-social/atproto/commit/95ef3c24e8072e9d49412950b033cb8607764ee0), [`5d8e7a6`](https://github.com/bluesky-social/atproto/commit/5d8e7a6588fc9e57e15d83d47bb45103205e3e41)]:
  - @atproto/oauth-types@0.6.0

## 0.3.4

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-types@0.5.2

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-types@0.5.1

## 0.3.2

### Patch Changes

- Updated dependencies [[`8ff5ec4ca`](https://github.com/bluesky-social/atproto/commit/8ff5ec4caa9a1f5c1e453a416ba2af22d1ee4f58), [`8ff5ec4ca`](https://github.com/bluesky-social/atproto/commit/8ff5ec4caa9a1f5c1e453a416ba2af22d1ee4f58), [`8ff5ec4ca`](https://github.com/bluesky-social/atproto/commit/8ff5ec4caa9a1f5c1e453a416ba2af22d1ee4f58)]:
  - @atproto/oauth-types@0.5.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3), [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815), [`fefe70126`](https://github.com/bluesky-social/atproto/commit/fefe70126d0ea82507ac750f669b3478290f186b), [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815), [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815), [`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3), [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815), [`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3)]:
  - @atproto/oauth-types@0.4.2
  - @atproto/jwk@0.6.0

## 0.3.0

### Minor Changes

- [`f4cb3e4d0`](https://github.com/bluesky-social/atproto/commit/f4cb3e4d0ac45e567fa14f79b99a84621fa89a56) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Adapt to UI to support permission set.

## 0.2.1

### Patch Changes

- Updated dependencies [[`8a88e2c15`](https://github.com/bluesky-social/atproto/commit/8a88e2c15451f5e8239400eeb277ad31d178b8e6), [`8a88e2c15`](https://github.com/bluesky-social/atproto/commit/8a88e2c15451f5e8239400eeb277ad31d178b8e6)]:
  - @atproto/jwk@0.5.0
  - @atproto/oauth-types@0.4.1

## 0.2.0

### Minor Changes

- [#3806](https://github.com/bluesky-social/atproto/pull/3806) [`1899b1fc1`](https://github.com/bluesky-social/atproto/commit/1899b1fc16bc5cd7bb930ec697898766c3a05add) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Adapt `AuthorizeData` backend injected data type

## 0.1.6

### Patch Changes

- Updated dependencies [[`3a1e010e1`](https://github.com/bluesky-social/atproto/commit/3a1e010e148476bfdc0028c37cafbce85a46605a), [`3a1e010e1`](https://github.com/bluesky-social/atproto/commit/3a1e010e148476bfdc0028c37cafbce85a46605a)]:
  - @atproto/oauth-types@0.4.0

## 0.1.5

### Patch Changes

- Updated dependencies [[`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee)]:
  - @atproto/jwk@0.4.0
  - @atproto/oauth-types@0.3.1

## 0.1.4

### Patch Changes

- Updated dependencies [[`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6), [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6), [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6), [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6), [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6)]:
  - @atproto/oauth-types@0.3.0
  - @atproto/jwk@0.3.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`3fa2ee3b6`](https://github.com/bluesky-social/atproto/commit/3fa2ee3b6a382709b10921da53e69a901bccbb05), [`a3b24ca77`](https://github.com/bluesky-social/atproto/commit/a3b24ca77ca24ac19b17cf9ee2a5ca9612ccf96c)]:
  - @atproto/jwk@0.2.0
  - @atproto/oauth-types@0.2.8

## 0.1.2

### Patch Changes

- Updated dependencies [[`a48b093f0`](https://github.com/bluesky-social/atproto/commit/a48b093f0ba3cf67b7abc50d309afcb336d8ead8)]:
  - @atproto/oauth-types@0.2.7

## 0.1.1

### Patch Changes

- Updated dependencies [[`30f9b6690`](https://github.com/bluesky-social/atproto/commit/30f9b6690e0e2c5810772e94e631322b9d89c65a), [`30f9b6690`](https://github.com/bluesky-social/atproto/commit/30f9b6690e0e2c5810772e94e631322b9d89c65a)]:
  - @atproto/oauth-types@0.2.6

## 0.1.0

### Minor Changes

- [#3659](https://github.com/bluesky-social/atproto/pull/3659) [`371e04aad`](https://github.com/bluesky-social/atproto/commit/371e04aad2a3e8ae3fe185ce15fc8eb051cab78e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Various adaptations

### Patch Changes

- Updated dependencies [[`371e04aad`](https://github.com/bluesky-social/atproto/commit/371e04aad2a3e8ae3fe185ce15fc8eb051cab78e), [`26a077716`](https://github.com/bluesky-social/atproto/commit/26a07771673bf1090a61efb7c970235f0b2509fc)]:
  - @atproto/oauth-types@0.2.5
  - @atproto/jwk@0.1.5

## 0.0.1

### Patch Changes

- [#3640](https://github.com/bluesky-social/atproto/pull/3640) [`cc4122652`](https://github.com/bluesky-social/atproto/commit/cc4122652ed42ba55826c019d0ec57bf25df1ecd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Exctracted types shared between OAuthProvider backand and it's UI into a separate package.
