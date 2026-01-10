# @atproto/jwk

## 0.6.0

### Minor Changes

- [#4103](https://github.com/bluesky-social/atproto/pull/4103) [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update key matching algorithm to support `key_ops`

- [#4103](https://github.com/bluesky-social/atproto/pull/4103) [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Only allow `"use"` claims in public jwk

### Patch Changes

- [#4103](https://github.com/bluesky-social/atproto/pull/4103) [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Silently ignore invalid JWKs from JSON Web Key Set (as per spec)

- [#4220](https://github.com/bluesky-social/atproto/pull/4220) [`fefe70126`](https://github.com/bluesky-social/atproto/commit/fefe70126d0ea82507ac750f669b3478290f186b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make the `jwk` property of `Key` instances public

- [#4103](https://github.com/bluesky-social/atproto/pull/4103) [`f560cf226`](https://github.com/bluesky-social/atproto/commit/f560cf2266715666ce5852ab095fcfb3876ae815) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Avoid using `revoked` and inactive keys from JWK sets

## 0.5.0

### Minor Changes

- [#4101](https://github.com/bluesky-social/atproto/pull/4101) [`8a88e2c15`](https://github.com/bluesky-social/atproto/commit/8a88e2c15451f5e8239400eeb277ad31d178b8e6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Prevent inconsistent use of `use` and `key_ops` in JWK

### Patch Changes

- [#4101](https://github.com/bluesky-social/atproto/pull/4101) [`8a88e2c15`](https://github.com/bluesky-social/atproto/commit/8a88e2c15451f5e8239400eeb277ad31d178b8e6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove requirement for JWK to define either `use` or `key_ops`.

## 0.4.0

### Minor Changes

- [#3976](https://github.com/bluesky-social/atproto/pull/3976) [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove export of internal utilities

- [#3976](https://github.com/bluesky-social/atproto/pull/3976) [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Return object instead of array as result of `findPrivateKey`

### Patch Changes

- [#3976](https://github.com/bluesky-social/atproto/pull/3976) [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `jwkPrivateSchema` to ensure a key is private

## 0.3.0

### Minor Changes

- [#3847](https://github.com/bluesky-social/atproto/pull/3847) [`349b59175`](https://github.com/bluesky-social/atproto/commit/349b59175e82ceb9500ae7c6a9a0b9b6aec9d1b6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `findKey` to `findPrivateKey` to better reflect the method's behavior

## 0.2.0

### Minor Changes

- [#3879](https://github.com/bluesky-social/atproto/pull/3879) [`3fa2ee3b6`](https://github.com/bluesky-social/atproto/commit/3fa2ee3b6a382709b10921da53e69a901bccbb05) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly validate JWK `htu` claim by enforcing URL without query or fragment

## 0.1.5

### Patch Changes

- [#3747](https://github.com/bluesky-social/atproto/pull/3747) [`26a077716`](https://github.com/bluesky-social/atproto/commit/26a07771673bf1090a61efb7c970235f0b2509fc) Thanks [@devinivy](https://github.com/devinivy)! - Fix typo in Keyset.findKey error message

## 0.1.4

### Patch Changes

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly support locales with 3 chars (Asturian)

## 0.1.3

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

## 0.1.2

### Patch Changes

- [#2879](https://github.com/bluesky-social/atproto/pull/2879) [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Mark jwk key fields as readonly

- [#2879](https://github.com/bluesky-social/atproto/pull/2879) [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove unsafe type casting during JWT verification

- [#2879](https://github.com/bluesky-social/atproto/pull/2879) [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow (passthrough) unknown properties in JWT payload & headers

- [#2879](https://github.com/bluesky-social/atproto/pull/2879) [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose ValidationError to allow for proper error handling

## 0.1.1

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow build from Parcel

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens
