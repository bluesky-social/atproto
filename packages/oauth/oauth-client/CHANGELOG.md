# @atproto/oauth-client

## 0.5.7

### Patch Changes

- [#4220](https://github.com/bluesky-social/atproto/pull/4220) [`fefe70126`](https://github.com/bluesky-social/atproto/commit/fefe70126d0ea82507ac750f669b3478290f186b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `core-js` to polyfill `Symbol.dispose`

- [#4216](https://github.com/bluesky-social/atproto/pull/4216) [`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `AbortSignal.timeout` to generate timeout based signals

- Updated dependencies [[`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3), [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815), [`fefe70126`](https://github.com/bluesky-social/atproto/commit/fefe70126d0ea82507ac750f669b3478290f186b), [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815), [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815), [`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3), [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815), [`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3), [`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3)]:
  - @atproto/oauth-types@0.4.2
  - @atproto/jwk@0.6.0
  - @atproto/did@0.2.1
  - @atproto-labs/did-resolver@0.2.2
  - @atproto-labs/handle-resolver@0.3.2
  - @atproto-labs/identity-resolver@0.3.2

## 0.5.6

### Patch Changes

- Updated dependencies []:
  - @atproto/xrpc@0.7.5

## 0.5.5

### Patch Changes

- [#4150](https://github.com/bluesky-social/atproto/pull/4150) [`86c4699da`](https://github.com/bluesky-social/atproto/commit/86c4699da8cf184c251e58c0a3a2612dd676f0ea) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `redirect_uri` validation on the client because it does not properly match loopback redirect uris

- Updated dependencies [[`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d)]:
  - @atproto/did@0.2.0
  - @atproto-labs/simple-store@0.3.0
  - @atproto/xrpc@0.7.4
  - @atproto-labs/did-resolver@0.2.1
  - @atproto-labs/handle-resolver@0.3.1
  - @atproto-labs/simple-store-memory@0.1.4
  - @atproto-labs/identity-resolver@0.3.1

## 0.5.4

### Patch Changes

- [#4139](https://github.com/bluesky-social/atproto/pull/4139) [`6231c8730`](https://github.com/bluesky-social/atproto/commit/6231c8730adb3a4c17dec417e5332b2be61070e5) Thanks [@ThisIsMissEm](https://github.com/ThisIsMissEm)! - Fix support for multiple redirect URIs in `@atproto/oauth-client`

  Previously the callback method assumed a singular `redirect_uris` value, and enforced only performing the callback with the first registered redirect URI. This change allows passing the actual redirect URI to the `callback` method, much like the `authorize` method supports.

- Updated dependencies []:
  - @atproto/xrpc@0.7.3

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @atproto/xrpc@0.7.2

## 0.5.2

### Patch Changes

- Updated dependencies [[`8a88e2c15`](https://github.com/bluesky-social/atproto/commit/8a88e2c15451f5e8239400eeb277ad31d178b8e6), [`8a88e2c15`](https://github.com/bluesky-social/atproto/commit/8a88e2c15451f5e8239400eeb277ad31d178b8e6)]:
  - @atproto/jwk@0.5.0
  - @atproto/oauth-types@0.4.1

## 0.5.1

### Patch Changes

- Updated dependencies []:
  - @atproto/xrpc@0.7.1

## 0.5.0

### Minor Changes

- [#3982](https://github.com/bluesky-social/atproto/pull/3982) [`4c2d49917`](https://github.com/bluesky-social/atproto/commit/4c2d499178c61eb8a9d7f658e89fe68fa07f81e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - `didResolver` and `handleResolver` no longer exposed on `OAuthClient` class

### Patch Changes

- [#3982](https://github.com/bluesky-social/atproto/pull/3982) [`4c2d49917`](https://github.com/bluesky-social/atproto/commit/4c2d499178c61eb8a9d7f658e89fe68fa07f81e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow providing custom `identityProvider` implementation as `OAuthClient` constructor option

- Updated dependencies [[`4c2d49917`](https://github.com/bluesky-social/atproto/commit/4c2d499178c61eb8a9d7f658e89fe68fa07f81e7), [`4c2d49917`](https://github.com/bluesky-social/atproto/commit/4c2d499178c61eb8a9d7f658e89fe68fa07f81e7), [`3a1e010e1`](https://github.com/bluesky-social/atproto/commit/3a1e010e148476bfdc0028c37cafbce85a46605a), [`4c2d49917`](https://github.com/bluesky-social/atproto/commit/4c2d499178c61eb8a9d7f658e89fe68fa07f81e7), [`3a1e010e1`](https://github.com/bluesky-social/atproto/commit/3a1e010e148476bfdc0028c37cafbce85a46605a)]:
  - @atproto-labs/identity-resolver@0.3.0
  - @atproto/oauth-types@0.4.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47), [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47), [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47), [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47), [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47), [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47), [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47)]:
  - @atproto-labs/handle-resolver@0.3.0
  - @atproto-labs/identity-resolver@0.2.0

## 0.4.1

### Patch Changes

- [#3976](https://github.com/bluesky-social/atproto/pull/3976) [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Re-export all types & utilities needed to instantiate an OAuth client

- [#3976](https://github.com/bluesky-social/atproto/pull/3976) [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow `OAuthClient` to be instantiated with custom `didResolver` instance

- Updated dependencies [[`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee)]:
  - @atproto-labs/handle-resolver@0.2.0
  - @atproto-labs/did-resolver@0.2.0
  - @atproto/jwk@0.4.0
  - @atproto-labs/identity-resolver@0.1.19
  - @atproto/oauth-types@0.3.1

## 0.4.0

### Minor Changes

- [#3847](https://github.com/bluesky-social/atproto/pull/3847) [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bind the OAuth session to the kid that was used to authenticate the client (private_key_jwt)

### Patch Changes

- [#3847](https://github.com/bluesky-social/atproto/pull/3847) [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add missing `exp` claim in client attestation JWT

- Updated dependencies [[`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6), [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6), [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6), [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6), [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6)]:
  - @atproto/oauth-types@0.3.0
  - @atproto/jwk@0.3.0

## 0.3.22

### Patch Changes

- [#3933](https://github.com/bluesky-social/atproto/pull/3933) [`192f3ab89`](https://github.com/bluesky-social/atproto/commit/192f3ab89c943216683541f42cc1332e9c305eee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use resolved handle or did instead of raw input as "login_hint"

- [#3926](https://github.com/bluesky-social/atproto/pull/3926) [`4e96e2c7b`](https://github.com/bluesky-social/atproto/commit/4e96e2c7b7cc0231607d3065c95704069c4ca2a2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `iss` claim from DPoP proofs

- Updated dependencies [[`192f3ab89`](https://github.com/bluesky-social/atproto/commit/192f3ab89c943216683541f42cc1332e9c305eee)]:
  - @atproto-labs/identity-resolver@0.1.18

## 0.3.21

### Patch Changes

- [#3935](https://github.com/bluesky-social/atproto/pull/3935) [`cd4bed3c9`](https://github.com/bluesky-social/atproto/commit/cd4bed3c9e68878c3f79620fe19f6994ebcb932e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Cache new DPoP nonces from successful retries

## 0.3.20

### Patch Changes

- [#3919](https://github.com/bluesky-social/atproto/pull/3919) [`a3b24ca77`](https://github.com/bluesky-social/atproto/commit/a3b24ca77ca24ac19b17cf9ee2a5ca9612ccf96c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `application/x-www-form-urlencoded` content instead of JSON for OAuth requests

- Updated dependencies [[`3fa2ee3b6`](https://github.com/bluesky-social/atproto/commit/3fa2ee3b6a382709b10921da53e69a901bccbb05), [`a3b24ca77`](https://github.com/bluesky-social/atproto/commit/a3b24ca77ca24ac19b17cf9ee2a5ca9612ccf96c)]:
  - @atproto/jwk@0.2.0
  - @atproto/oauth-types@0.2.8

## 0.3.19

### Patch Changes

- [#3877](https://github.com/bluesky-social/atproto/pull/3877) [`a03f0b906`](https://github.com/bluesky-social/atproto/commit/a03f0b906b108f8c766a5700f0d68b55748f23bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove un-necessary validation of `alg` on every dpop token creation

## 0.3.18

### Patch Changes

- [`36d0d370c`](https://github.com/bluesky-social/atproto/commit/36d0d370c24498f74c243ebfb01564e5050c672d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove query & fragment from DPoP proof `htu` claim

## 0.3.17

### Patch Changes

- Updated dependencies [[`5050b6550`](https://github.com/bluesky-social/atproto/commit/5050b6550e07e71b0a524eda0b71b837583294d4)]:
  - @atproto-labs/fetch@0.2.3
  - @atproto-labs/did-resolver@0.1.13
  - @atproto-labs/identity-resolver@0.1.17

## 0.3.16

### Patch Changes

- Updated dependencies [[`a48b093f0`](https://github.com/bluesky-social/atproto/commit/a48b093f0ba3cf67b7abc50d309afcb336d8ead8), [`f36ab48d9`](https://github.com/bluesky-social/atproto/commit/f36ab48d910fc4a3afcd22138ba014c814beb93b), [`f36ab48d9`](https://github.com/bluesky-social/atproto/commit/f36ab48d910fc4a3afcd22138ba014c814beb93b), [`f36ab48d9`](https://github.com/bluesky-social/atproto/commit/f36ab48d910fc4a3afcd22138ba014c814beb93b)]:
  - @atproto/oauth-types@0.2.7
  - @atproto/xrpc@0.7.0

## 0.3.15

### Patch Changes

- Updated dependencies [[`0d77d1b55`](https://github.com/bluesky-social/atproto/commit/0d77d1b550a58117aee8f7f1e2be24d255ade9e4), [`30f9b6690`](https://github.com/bluesky-social/atproto/commit/30f9b6690e0e2c5810772e94e631322b9d89c65a), [`30f9b6690`](https://github.com/bluesky-social/atproto/commit/30f9b6690e0e2c5810772e94e631322b9d89c65a), [`0d77d1b55`](https://github.com/bluesky-social/atproto/commit/0d77d1b550a58117aee8f7f1e2be24d255ade9e4)]:
  - @atproto-labs/simple-store@0.2.0
  - @atproto/oauth-types@0.2.6
  - @atproto-labs/did-resolver@0.1.12
  - @atproto-labs/handle-resolver@0.1.8
  - @atproto-labs/simple-store-memory@0.1.3
  - @atproto-labs/identity-resolver@0.1.16

## 0.3.14

### Patch Changes

- Updated dependencies [[`371e04aad`](https://github.com/bluesky-social/atproto/commit/371e04aad2a3e8ae3fe185ce15fc8eb051cab78e), [`26a077716`](https://github.com/bluesky-social/atproto/commit/26a07771673bf1090a61efb7c970235f0b2509fc)]:
  - @atproto/oauth-types@0.2.5
  - @atproto/jwk@0.1.5

## 0.3.13

### Patch Changes

- Updated dependencies []:
  - @atproto/xrpc@0.6.12

## 0.3.12

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/identity-resolver@0.1.15
  - @atproto/xrpc@0.6.11

## 0.3.11

### Patch Changes

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Minor code optimizations

- Updated dependencies [[`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29), [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29), [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29)]:
  - @atproto-labs/fetch@0.2.2
  - @atproto/oauth-types@0.2.4
  - @atproto/jwk@0.1.4
  - @atproto-labs/did-resolver@0.1.11
  - @atproto-labs/identity-resolver@0.1.14
  - @atproto/xrpc@0.6.10

## 0.3.10

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/identity-resolver@0.1.13
  - @atproto/xrpc@0.6.9

## 0.3.9

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto-labs/simple-store-memory@0.1.2
  - @atproto-labs/identity-resolver@0.1.12
  - @atproto-labs/handle-resolver@0.1.7
  - @atproto-labs/did-resolver@0.1.10
  - @atproto-labs/simple-store@0.1.2
  - @atproto/oauth-types@0.2.3
  - @atproto-labs/fetch@0.2.1
  - @atproto/jwk@0.1.3
  - @atproto/xrpc@0.6.8
  - @atproto/did@0.1.5

## 0.3.8

### Patch Changes

- Updated dependencies [[`cc2a1222b`](https://github.com/bluesky-social/atproto/commit/cc2a1222bd2b8ddd70d70dad174c1c63246a2d87), [`cc2a1222b`](https://github.com/bluesky-social/atproto/commit/cc2a1222bd2b8ddd70d70dad174c1c63246a2d87), [`fb64d50ee`](https://github.com/bluesky-social/atproto/commit/fb64d50ee220316b9f1183e5c3259629489734c9)]:
  - @atproto-labs/did-resolver@0.1.9
  - @atproto/did@0.1.4
  - @atproto/xrpc@0.6.7
  - @atproto-labs/identity-resolver@0.1.11
  - @atproto-labs/handle-resolver@0.1.6

## 0.3.7

### Patch Changes

- Updated dependencies [[`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`5ece8c6ae`](https://github.com/bluesky-social/atproto/commit/5ece8c6aeab9c5c3f51295d93ed6e27c3c6095c2), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`5ece8c6ae`](https://github.com/bluesky-social/atproto/commit/5ece8c6aeab9c5c3f51295d93ed6e27c3c6095c2)]:
  - @atproto/jwk@0.1.2
  - @atproto-labs/fetch@0.2.0
  - @atproto/oauth-types@0.2.2
  - @atproto-labs/did-resolver@0.1.8
  - @atproto-labs/identity-resolver@0.1.10

## 0.3.6

### Patch Changes

- Updated dependencies [[`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99)]:
  - @atproto-labs/did-resolver@0.1.7
  - @atproto-labs/identity-resolver@0.1.9
  - @atproto/xrpc@0.6.6

## 0.3.5

### Patch Changes

- Updated dependencies [[`a200e5095`](https://github.com/bluesky-social/atproto/commit/a200e50951d297c3f9670e96027262196bc29b0b)]:
  - @atproto-labs/handle-resolver@0.1.5
  - @atproto-labs/identity-resolver@0.1.8

## 0.3.4

### Patch Changes

- Updated dependencies []:
  - @atproto/xrpc@0.6.5

## 0.3.3

### Patch Changes

- Updated dependencies [[`622654672`](https://github.com/bluesky-social/atproto/commit/6226546725d1bb0375e3c9e0d71af173e8253c4f)]:
  - @atproto-labs/fetch@0.1.2
  - @atproto-labs/did-resolver@0.1.6
  - @atproto-labs/identity-resolver@0.1.7

## 0.3.2

### Patch Changes

- [#3066](https://github.com/bluesky-social/atproto/pull/3066) [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Verify authorization_endpoint URL protocol

- [#3066](https://github.com/bluesky-social/atproto/pull/3066) [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Ensure that client-id is a web url

- [#3066](https://github.com/bluesky-social/atproto/pull/3066) [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve message of OAuthResolverError in case of metadata validation error

- Updated dependencies [[`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3), [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3), [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3)]:
  - @atproto/oauth-types@0.2.1

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/identity-resolver@0.1.6
  - @atproto/xrpc@0.6.4

## 0.3.0

### Minor Changes

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `"auto"` instead of `undefined` to descibe the refresh mechanism to use in various methods.

### Patch Changes

- [#2874](https://github.com/bluesky-social/atproto/pull/2874) [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `allowHttp` OAuthClient construction option to allow working with "http:" oauth providers (for development & testing purposes).

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Perform issuer validation _before_ refreshing tokens.

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Ensure token response is properly typed according to the atproto OAuth spec

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use fetch()'s "cache" option instead of headers to force caching behavior

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Do not use cache when checking sub authority

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow all oauth request parameters to be used as authorize() options

- Updated dependencies [[`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf)]:
  - @atproto/oauth-types@0.2.0
  - @atproto-labs/did-resolver@0.1.5
  - @atproto-labs/handle-resolver@0.1.4
  - @atproto/did@0.1.3
  - @atproto-labs/identity-resolver@0.1.5

## 0.2.2

### Patch Changes

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve client side validation of client metadata

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use scope from client metadata as default value

- Updated dependencies [[`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3)]:
  - @atproto/oauth-types@0.1.5
  - @atproto/xrpc@0.6.3
  - @atproto-labs/fetch@0.1.1
  - @atproto-labs/did-resolver@0.1.4
  - @atproto-labs/identity-resolver@0.1.4

## 0.2.1

### Patch Changes

- Updated dependencies [[`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c), [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c), [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c), [`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93)]:
  - @atproto/did@0.1.2
  - @atproto/xrpc@0.6.2
  - @atproto-labs/did-resolver@0.1.3
  - @atproto-labs/handle-resolver@0.1.3
  - @atproto-labs/identity-resolver@0.1.3

## 0.2.0

### Minor Changes

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The `OAuthClient` (and runtime specific sub-classes) no longer return @atproto/api `Agent` instances. Instead, they return `OAuthSession` instances that can be used to instantiate the `Agent` class.

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove "nonce" from authorization request

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Mandate the use of "atproto" scope

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove "openid" compatibility. The reason is that although we were technically "openid" compatible, ATProto identifiers are distributed identifiers. When a client relies on OpenID to authenticate users, it will use the auth provider in combination with the identifier to uniquely identify the user. Since ATProto identifiers are meant to be able to move from one provider to the other, OpenID compatibility could break authentication after a user was migrated to a different provider.

  The way OpenID compliant clients would adapt to this particularity would typically be to remove the provider + identifier combination and use the identifier alone. While this is indeed the right way to handle ATProto identifiers, it requires more work to avoid impersonation. In particular, when obtaining a user identifier, the client **must** verify that the issuer of the identity token is indeed the server responsible for that user. This mechanism being not enforced by the OpenID standard, OpenID compatibility could lead to security issues. For this reason, we decided to remove OpenID compatibility from the OAuth provider.

  Note that a trusted central authority could still offer OpenID compatibility by relying on ATProto's regular OAuth flow under the hood. This capability is out of the scope of this library.

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename OAuthAgent into OAuthSession

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `OAuthSession`'s `request` method to `fetchHandler`. The goal of this change is to allow `OAuthSession` to be used in order to instantiate `XrpcClient` by implementing the `FetchHandlerObject` interface.

### Patch Changes

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `getTokenInfo()` method to `OAuthSession`.

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Do not remove scopes not advertised in the AS's "scopes_supported" when building the authorization request.

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make `getTokenSet()` method public in `OAuthSession`.

- Updated dependencies [[`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c), [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7), [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7), [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7), [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c), [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c)]:
  - @atproto/xrpc@0.6.1
  - @atproto/oauth-types@0.1.4

## 0.1.7

### Patch Changes

- Updated dependencies [[`4ab248354`](https://github.com/bluesky-social/atproto/commit/4ab2483547d5dabfba88ed4419a4f374bbd7cae7)]:
  - @atproto/api@0.13.3

## 0.1.6

### Patch Changes

- Updated dependencies [[`2a0c088cc`](https://github.com/bluesky-social/atproto/commit/2a0c088cc5d502ca70da9612a261186aa2f2e1fb), [`aba664fbd`](https://github.com/bluesky-social/atproto/commit/aba664fbdfbaddba321e96db2478e0bc8fc72d27)]:
  - @atproto/api@0.13.2

## 0.1.5

### Patch Changes

- [#2729](https://github.com/bluesky-social/atproto/pull/2729) [`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The non-standard `introspection_endpoint_auth_method`, and `introspection_endpoint_auth_signing_alg` client metadata properties were removed. The client's `token_endpoint_auth_method`, and `token_endpoint_auth_signing_alg` properties are now used as the only indication of how a client must authenticate at the introspection endpoint.

- [#2729](https://github.com/bluesky-social/atproto/pull/2729) [`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The non-standard `revocation_endpoint_auth_method`, and `revocation_endpoint_auth_signing_alg` client metadata properties were removed. The client's `token_endpoint_auth_method`, and `token_endpoint_auth_signing_alg` properties are now used as the only indication of how a client must authenticate at the revocation endpoint.

- [#2727](https://github.com/bluesky-social/atproto/pull/2727) [`3ebcd4e61`](https://github.com/bluesky-social/atproto/commit/3ebcd4e6161291d3649d7f8a9c5ee4ac26d590a2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove "exp" from dpop proof

- [#2729](https://github.com/bluesky-social/atproto/pull/2729) [`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The non-standard `pushed_authorization_request_endpoint_auth_method`, and `pushed_authorization_request_endpoint_auth_signing_alg` client metadata properties were removed. The client's `token_endpoint_auth_method`, and `token_endpoint_auth_signing_alg` properties are now used as the only indication of how a client must authenticate at the introspection endpoint.

- Updated dependencies [[`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb)]:
  - @atproto/oauth-types@0.1.3

## 0.1.4

### Patch Changes

- [#2710](https://github.com/bluesky-social/atproto/pull/2710) [`04112783d`](https://github.com/bluesky-social/atproto/commit/04112783db17f865c9e2b673190f77dd0b7461e3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add CustomEvent ponyfill for enviroments that don't provide it

## 0.1.3

### Patch Changes

- Updated dependencies [[`22af354a5`](https://github.com/bluesky-social/atproto/commit/22af354a5db595d7cbc0e65f02601de3565337e1)]:
  - @atproto/api@0.13.1

## 0.1.2

### Patch Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Misc fixes for confidential client usage

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Better implement aptroto OAuth spec

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd)]:
  - @atproto/oauth-types@0.1.2
  - @atproto-labs/handle-resolver@0.1.2
  - @atproto/did@0.1.1
  - @atproto/xrpc@0.6.0
  - @atproto/api@0.13.0
  - @atproto-labs/identity-resolver@0.1.2
  - @atproto-labs/did-resolver@0.1.2

## 0.1.1

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add event emitting capability to OAuthClient

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10), [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10), [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10), [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto/oauth-types@0.1.1
  - @atproto/jwk@0.1.1
  - @atproto-labs/identity-resolver@0.1.1
  - @atproto-labs/handle-resolver@0.1.1
  - @atproto-labs/did-resolver@0.1.1
  - @atproto-labs/simple-store@0.1.1
  - @atproto-labs/simple-store-memory@0.1.1

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens

### Patch Changes

- Updated dependencies [[`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646)]:
  - @atproto-labs/simple-store-memory@0.1.0
  - @atproto-labs/identity-resolver@0.1.0
  - @atproto-labs/handle-resolver@0.1.0
  - @atproto-labs/did-resolver@0.1.0
  - @atproto-labs/simple-store@0.1.0
  - @atproto/oauth-types@0.1.0
  - @atproto-labs/fetch@0.1.0
  - @atproto/jwk@0.1.0
  - @atproto/did@0.1.0
