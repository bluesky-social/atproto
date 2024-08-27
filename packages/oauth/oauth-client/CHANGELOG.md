# @atproto/oauth-client

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
