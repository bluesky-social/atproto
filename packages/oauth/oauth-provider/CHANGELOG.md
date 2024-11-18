# @atproto/oauth-provider

## 0.2.7

### Patch Changes

- [#2852](https://github.com/bluesky-social/atproto/pull/2852) [`709ba3015`](https://github.com/bluesky-social/atproto/commit/709ba301578c1956b8eb0d89bad717615a4fd7ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove response content-encoding logic

## 0.2.6

### Patch Changes

- [#2902](https://github.com/bluesky-social/atproto/pull/2902) [`8f2b80a0d`](https://github.com/bluesky-social/atproto/commit/8f2b80a0dcf118652452ea09764a947b09991e0f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Better report invalid content-encoding errors

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow using different ioredis version

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use fetch()'s "cache" option instead of headers to force caching behavior

- [#2874](https://github.com/bluesky-social/atproto/pull/2874) [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve error message when invalid client id used during code exchange

- Updated dependencies [[`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2), [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf)]:
  - @atproto/oauth-types@0.2.0

## 0.2.5

### Patch Changes

- Updated dependencies [[`80450cbf2`](https://github.com/bluesky-social/atproto/commit/80450cbf2ca27967ee9fe1a5f4bc590b26f1e6b2)]:
  - @atproto-labs/fetch-node@0.1.3

## 0.2.4

### Patch Changes

- Updated dependencies [[`8943c1008`](https://github.com/bluesky-social/atproto/commit/8943c10082702bbc0fc150237c6cc421251afd51)]:
  - @atproto-labs/fetch-node@0.1.2

## 0.2.3

### Patch Changes

- [#2847](https://github.com/bluesky-social/atproto/pull/2847) [`1226ed268`](https://github.com/bluesky-social/atproto/commit/1226ed2682970a58ae433b9deb11290333988ddd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Do not display the client_name of untrusted clients

- Updated dependencies [[`4098d9890`](https://github.com/bluesky-social/atproto/commit/4098d9890173f4d6c6512f2d8994eebbf12b5e13)]:
  - @atproto/common@0.4.4

## 0.2.2

### Patch Changes

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Disable request params scopes defaulting to client metadata scopes. Requires that client always provide a "scope" parameter when initiating an oauth flow.

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove "plain" from code_challenge_methods_supported

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Require definition of "scope" in client metadata document

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve reporting of metadata validation error

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly validate request_uri request parameter

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Enforce code_challenge_method=S256 request parameter

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Explicitely forbid MTLS client auth method

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Return "invalid_client" on invalid client credentials

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Prevent use of empty string in unsupported oidc request parameters

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow fetching of source maps files from browser debugger

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow native clients to use https: redirect uris

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow client metadata to contain other values than "code"

- [#2770](https://github.com/bluesky-social/atproto/pull/2770) [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve code re-use

- Updated dependencies [[`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3)]:
  - @atproto/oauth-types@0.1.5
  - @atproto-labs/fetch-node@0.1.1
  - @atproto/common@0.4.3
  - @atproto-labs/fetch@0.1.1

## 0.2.1

### Patch Changes

- [#2749](https://github.com/bluesky-social/atproto/pull/2749) [`c180cf4d8`](https://github.com/bluesky-social/atproto/commit/c180cf4d86d174c24dd640d3c95b8a461c0cd41d) Thanks [@devinivy](https://github.com/devinivy)! - Fix client-side crash on authorize page

## 0.2.0

### Minor Changes

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove "nonce" from authorization request

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Mandate the use of "atproto" scope

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove "openid" compatibility. The reason is that although we were technically "openid" compatible, ATProto identifiers are distributed identifiers. When a client relies on OpenID to authenticate users, it will use the auth provider in combination with the identifier to uniquely identify the user. Since ATProto identifiers are meant to be able to move from one provider to the other, OpenID compatibility could break authentication after a user was migrated to a different provider.

  The way OpenID compliant clients would adapt to this particularity would typically be to remove the provider + identifier combination and use the identifier alone. While this is indeed the right way to handle ATProto identifiers, it requires more work to avoid impersonation. In particular, when obtaining a user identifier, the client **must** verify that the issuer of the identity token is indeed the server responsible for that user. This mechanism being not enforced by the OpenID standard, OpenID compatibility could lead to security issues. For this reason, we decided to remove OpenID compatibility from the OAuth provider.

  Note that a trusted central authority could still offer OpenID compatibility by relying on ATProto's regular OAuth flow under the hood. This capability is out of the scope of this library.

### Patch Changes

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Display requested scopes during the auth flow

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Generate proper invalid_authorization_details

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Stronger CORS protections

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Do not require user consent during oauth flow for first party apps.

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve reporting of validation errors

- Updated dependencies [[`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7), [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7), [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7)]:
  - @atproto/oauth-types@0.1.4

## 0.1.3

### Patch Changes

- [#2729](https://github.com/bluesky-social/atproto/pull/2729) [`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The non-standard `introspection_endpoint_auth_method`, and `introspection_endpoint_auth_signing_alg` client metadata properties were removed. The client's `token_endpoint_auth_method`, and `token_endpoint_auth_signing_alg` properties are now used as the only indication of how a client must authenticate at the introspection endpoint.

- [#2729](https://github.com/bluesky-social/atproto/pull/2729) [`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The non-standard `revocation_endpoint_auth_method`, and `revocation_endpoint_auth_signing_alg` client metadata properties were removed. The client's `token_endpoint_auth_method`, and `token_endpoint_auth_signing_alg` properties are now used as the only indication of how a client must authenticate at the revocation endpoint.

- [#2729](https://github.com/bluesky-social/atproto/pull/2729) [`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb) Thanks [@matthieusieben](https://github.com/matthieusieben)! - The non-standard `pushed_authorization_request_endpoint_auth_method`, and `pushed_authorization_request_endpoint_auth_signing_alg` client metadata properties were removed. The client's `token_endpoint_auth_method`, and `token_endpoint_auth_signing_alg` properties are now used as the only indication of how a client must authenticate at the introspection endpoint.

- [#2728](https://github.com/bluesky-social/atproto/pull/2728) [`5131b027f`](https://github.com/bluesky-social/atproto/commit/5131b027f019cf9f8ec47605648063ae1857f1e3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow charset in content-type header of incoming requests

- [#2727](https://github.com/bluesky-social/atproto/pull/2727) [`3ebcd4e61`](https://github.com/bluesky-social/atproto/commit/3ebcd4e6161291d3649d7f8a9c5ee4ac26d590a2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Do not require "exp" claim in dpop proof

- Updated dependencies [[`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb)]:
  - @atproto/oauth-types@0.1.3

## 0.1.2

### Patch Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove unused file

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd)]:
  - @atproto/jwk-jose@0.1.2
  - @atproto/oauth-types@0.1.2

## 0.1.1

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add 2FA support

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10), [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10), [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10), [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto/oauth-types@0.1.1
  - @atproto/jwk-jose@0.1.1
  - @atproto/jwk@0.1.1
  - @atproto-labs/simple-store@0.1.1
  - @atproto-labs/simple-store-memory@0.1.1

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens

### Patch Changes

- Updated dependencies [[`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646)]:
  - @atproto-labs/simple-store-memory@0.1.0
  - @atproto-labs/simple-store@0.1.0
  - @atproto-labs/fetch-node@0.1.0
  - @atproto/oauth-types@0.1.0
  - @atproto-labs/fetch@0.1.0
  - @atproto/jwk-jose@0.1.0
  - @atproto-labs/pipe@0.1.0
  - @atproto/jwk@0.1.0
