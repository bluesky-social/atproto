# @atproto/oauth-types

## 0.2.3

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Support environments not providing URL.canParse

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto/jwk@0.1.3

## 0.2.2

### Patch Changes

- Updated dependencies [[`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0)]:
  - @atproto/jwk@0.1.2

## 0.2.1

### Patch Changes

- [#3066](https://github.com/bluesky-social/atproto/pull/3066) [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add oauthClientIdLoopbackSchema and oauthClientIdDiscoverableSchema schemas

- [#3066](https://github.com/bluesky-social/atproto/pull/3066) [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Enforce use of http and https url where applicable

- [#3066](https://github.com/bluesky-social/atproto/pull/3066) [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Strong validation or redirect_uri

## 0.2.0

### Minor Changes

- [#2874](https://github.com/bluesky-social/atproto/pull/2874) [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow oauthIssuerIdentifier to be an "http:" url. Make sure to manually check for "http:" issuers if you don't allow them.

- [#2874](https://github.com/bluesky-social/atproto/pull/2874) [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove ALLOW_UNSECURE_ORIGINS constant

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove invalid `issuer` property from OAuthTokenResponse

### Patch Changes

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add missing "wap" display request parameter value

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove invalid `client_id` property from oauthRefreshTokenGrantTokenRequestSchema

- [#2874](https://github.com/bluesky-social/atproto/pull/2874) [`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve typing of oauthIssuerIdentifierSchema

## 0.1.5

### Patch Changes

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly validate client metadata scope

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow ClientID query params to end with a slash "/" char

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose OAuthScope

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - add assertion utils for client ids

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow loopback client ids to omit the (empty) path parameter

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Enforce ClientID URL path to be normalized

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename OAuthAuthenticationRequestParameters to OAuthAuthorizationRequestParameters

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Restrict the value used as code_challenge_methods_supported

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add missing "expires_in" property to OAuthParResponse type definition

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow loopback clients to define their scopes through the "scope" client_id query parameter.

- [#2755](https://github.com/bluesky-social/atproto/pull/2755) [`ed325d863`](https://github.com/bluesky-social/atproto/commit/ed325d863ce8ea5986c5a45c3188aaa35288b7a8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve error description in case of invalid loopback client_id

## 0.1.4

### Patch Changes

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Validate scopes characters according to OAuth 2.1 spec

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Re-use code definition of oauthResponseTypeSchema

- [#2734](https://github.com/bluesky-social/atproto/pull/2734) [`dee817b6e`](https://github.com/bluesky-social/atproto/commit/dee817b6e0fc02351d51ce310b5e65239b7c5ed7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove non-standard "sub" from OAuthTokenResponse

## 0.1.3

### Patch Changes

- [#2729](https://github.com/bluesky-social/atproto/pull/2729) [`35a126429`](https://github.com/bluesky-social/atproto/commit/35a1264297bc22acaa6e5ed3f4aed8c351be8bbb) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Avoid code duplication in the definition of OAuthEndpointName

## 0.1.2

### Patch Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Better implement aptroto OAuth spec

## 0.1.1

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add client_id_metadata_document_supported in metadata

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto/jwk@0.1.1

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens

### Patch Changes

- Updated dependencies [[`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646)]:
  - @atproto/jwk@0.1.0
