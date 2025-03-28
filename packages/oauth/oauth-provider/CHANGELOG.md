# @atproto/oauth-provider

## 0.6.4

### Patch Changes

- [#3690](https://github.com/bluesky-social/atproto/pull/3690) [`9b28184cb`](https://github.com/bluesky-social/atproto/commit/9b28184cb9c417173f46cfb5824dc197dec3e069) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose hcaptcha tokens in hook and errors

- [#3690](https://github.com/bluesky-social/atproto/pull/3690) [`9b28184cb`](https://github.com/bluesky-social/atproto/commit/9b28184cb9c417173f46cfb5824dc197dec3e069) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove hcaptcha hostname check

## 0.6.3

### Patch Changes

- [#3688](https://github.com/bluesky-social/atproto/pull/3688) [`98d8a677c`](https://github.com/bluesky-social/atproto/commit/98d8a677ca4671137727d14567c8354c48c9e850) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add debugging info to HCaptcha validation errors

- [#3688](https://github.com/bluesky-social/atproto/pull/3688) [`98d8a677c`](https://github.com/bluesky-social/atproto/commit/98d8a677ca4671137727d14567c8354c48c9e850) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add hook with hcaptcha result

## 0.6.2

### Patch Changes

- [#3681](https://github.com/bluesky-social/atproto/pull/3681) [`a5a760c1f`](https://github.com/bluesky-social/atproto/commit/a5a760c1f0efd7246c9eebbc0f482d2f505de0a1) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow null hostname in hcaptcha result

## 0.6.1

### Patch Changes

- [#3656](https://github.com/bluesky-social/atproto/pull/3656) [`42807cad5`](https://github.com/bluesky-social/atproto/commit/42807cad56786e402d601ef9ed97379d5641a2c6) Thanks [@Johannes-Andersen](https://github.com/Johannes-Andersen)! - hCaptcha error codes should be optional

## 0.6.0

### Minor Changes

- [#3645](https://github.com/bluesky-social/atproto/pull/3645) [`49528e83d`](https://github.com/bluesky-social/atproto/commit/49528e83daee8d91c1956b13cc73e9c2b79b6b10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove onSignupHcaptchaResult hook

- [#3645](https://github.com/bluesky-social/atproto/pull/3645) [`49528e83d`](https://github.com/bluesky-social/atproto/commit/49528e83daee8d91c1956b13cc73e9c2b79b6b10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow `onSignedUp` hook to access hcaptcha result data.

### Patch Changes

- [#3645](https://github.com/bluesky-social/atproto/pull/3645) [`49528e83d`](https://github.com/bluesky-social/atproto/commit/49528e83daee8d91c1956b13cc73e9c2b79b6b10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix hcaptcha verification based on score

- [#3627](https://github.com/bluesky-social/atproto/pull/3627) [`9332c0f31`](https://github.com/bluesky-social/atproto/commit/9332c0f315bb7270bf346f69ecb178481ed07764) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix CSP directives for assets loaded through an `src`.

- [#3627](https://github.com/bluesky-social/atproto/pull/3627) [`9332c0f31`](https://github.com/bluesky-social/atproto/commit/9332c0f315bb7270bf346f69ecb178481ed07764) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make CSP header shorter (by combining <script> tags in the backend, when possible)

- [#3627](https://github.com/bluesky-social/atproto/pull/3627) [`9332c0f31`](https://github.com/bluesky-social/atproto/commit/9332c0f315bb7270bf346f69ecb178481ed07764) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Disable un-necessary pre-loading of assets

- [#3640](https://github.com/bluesky-social/atproto/pull/3640) [`cc4122652`](https://github.com/bluesky-social/atproto/commit/cc4122652ed42ba55826c019d0ec57bf25df1ecd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Split OAuth Provider's ui into its own package

- [#3627](https://github.com/bluesky-social/atproto/pull/3627) [`9332c0f31`](https://github.com/bluesky-social/atproto/commit/9332c0f315bb7270bf346f69ecb178481ed07764) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fixes issue in internal HTML generation class

- [#3627](https://github.com/bluesky-social/atproto/pull/3627) [`9332c0f31`](https://github.com/bluesky-social/atproto/commit/9332c0f315bb7270bf346f69ecb178481ed07764) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Set `Cross-Origin-Embedder-Policy` to `unsafe-none` when HCaptcha is enabled

- [#3645](https://github.com/bluesky-social/atproto/pull/3645) [`49528e83d`](https://github.com/bluesky-social/atproto/commit/49528e83daee8d91c1956b13cc73e9c2b79b6b10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve HCaptcha error reporting

- Updated dependencies [[`cc4122652`](https://github.com/bluesky-social/atproto/commit/cc4122652ed42ba55826c019d0ec57bf25df1ecd), [`cc4122652`](https://github.com/bluesky-social/atproto/commit/cc4122652ed42ba55826c019d0ec57bf25df1ecd), [`670b6b5de`](https://github.com/bluesky-social/atproto/commit/670b6b5de2bf91e6944761c98eb1126fb6a681ee)]:
  - @atproto/oauth-provider-ui@0.0.2
  - @atproto/oauth-provider-api@0.0.1
  - @atproto/syntax@0.4.0

## 0.5.2

### Patch Changes

- [#3622](https://github.com/bluesky-social/atproto/pull/3622) [`9e3eace8f`](https://github.com/bluesky-social/atproto/commit/9e3eace8f9c22141e6da80b7696cd3b3e7c38779) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly validate handle syntax during sign-up

- [#3621](https://github.com/bluesky-social/atproto/pull/3621) [`5ada66ceb`](https://github.com/bluesky-social/atproto/commit/5ada66ceb9d5b2c64f112bb62da0edc421c765bf) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow invite codes in any format

## 0.5.1

### Patch Changes

- [#3611](https://github.com/bluesky-social/atproto/pull/3611) [`c01d7f5d1`](https://github.com/bluesky-social/atproto/commit/c01d7f5d155445d7741c09f91c84af64b31bdbed) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make branding colors optional

- [#3614](https://github.com/bluesky-social/atproto/pull/3614) [`8827ff433`](https://github.com/bluesky-social/atproto/commit/8827ff433a211d2db80840cfc4ee146a7fb44849) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve branding parsing

## 0.5.0

### Minor Changes

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for account sign-up

### Patch Changes

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for password reset

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly support locales with 3 chars (Asturian)

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for multiple locales

- Updated dependencies [[`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29), [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29), [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29)]:
  - @atproto-labs/fetch@0.2.2
  - @atproto/oauth-types@0.2.4
  - @atproto/jwk@0.1.4
  - @atproto-labs/fetch-node@0.1.8
  - @atproto/jwk-jose@0.1.5

## 0.4.0

### Minor Changes

- [#3557](https://github.com/bluesky-social/atproto/pull/3557) [`82d5a2d36`](https://github.com/bluesky-social/atproto/commit/82d5a2d3617c40caab7a18e46c709c4b3c48e7f8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - DeviceManager options can now be passed as argument to the OAuthProvider constructor

- [#3557](https://github.com/bluesky-social/atproto/pull/3557) [`82d5a2d36`](https://github.com/bluesky-social/atproto/commit/82d5a2d3617c40caab7a18e46c709c4b3c48e7f8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update "trustProxy" options to allow function

## 0.3.1

### Patch Changes

- [#3538](https://github.com/bluesky-social/atproto/pull/3538) [`bde6f71c4`](https://github.com/bluesky-social/atproto/commit/bde6f71c4cd33022d29da0ff23463a5838c4de24) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Mark "userAgent" as optional in `RequestMetadata`

## 0.3.0

### Minor Changes

- [#3525](https://github.com/bluesky-social/atproto/pull/3525) [`6ea9c961a`](https://github.com/bluesky-social/atproto/commit/6ea9c961af964cd9b0d00b5073c695c5e0b3345a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `onClientInfo` and `onAuthorizationDetails` hooks to `getClientInfo` and `getAuthorizationDetails` respectively.

### Patch Changes

- [#3525](https://github.com/bluesky-social/atproto/pull/3525) [`6ea9c961a`](https://github.com/bluesky-social/atproto/commit/6ea9c961af964cd9b0d00b5073c695c5e0b3345a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add the following hooks in the `OAuthProvider`:

  - `onAuthorized` which is triggered when the user "authorized" a client (a `code` is issued)
  - `onTokenCreated` which is triggered when the code is exchanged for a token
  - `onTokenRefreshed` which is triggered when a refresh token is exchanged for a new access token

- [#3514](https://github.com/bluesky-social/atproto/pull/3514) [`e69e89a03`](https://github.com/bluesky-social/atproto/commit/e69e89a037829bd4f6656d6aa42b77b97b4934e5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly compute sleep time in contantTime util

## 0.2.17

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update NodeJS engine requirement to >=18.7.0

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto-labs/simple-store-memory@0.1.2
  - @atproto-labs/simple-store@0.1.2
  - @atproto-labs/fetch-node@0.1.7
  - @atproto/oauth-types@0.2.3
  - @atproto-labs/fetch@0.2.1
  - @atproto/jwk-jose@0.1.4
  - @atproto/jwk@0.1.3
  - @atproto/common@0.4.8

## 0.2.16

### Patch Changes

- Updated dependencies [[`52c687a05`](https://github.com/bluesky-social/atproto/commit/52c687a05c70d5660fae1de9e1bbc6297f37f1f4)]:
  - @atproto/common@0.4.7

## 0.2.15

### Patch Changes

- [#3432](https://github.com/bluesky-social/atproto/pull/3432) [`b04943191`](https://github.com/bluesky-social/atproto/commit/b04943191b9f89a5263a77358d47d1362a6454a6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add user friendly description for transition:\* scopes

## 0.2.14

### Patch Changes

- [#3415](https://github.com/bluesky-social/atproto/pull/3415) [`c5a4cdb0a`](https://github.com/bluesky-social/atproto/commit/c5a4cdb0a52f4583ffe783a0b259e80263f24a8c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve error description in case invalid DPoP nonce is used

## 0.2.13

### Patch Changes

- Updated dependencies [[`9c0128193`](https://github.com/bluesky-social/atproto/commit/9c01281931a371304bcfa465005d7363c003bc5f)]:
  - @atproto-labs/fetch-node@0.1.6

## 0.2.12

### Patch Changes

- Updated dependencies [[`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`5ece8c6ae`](https://github.com/bluesky-social/atproto/commit/5ece8c6aeab9c5c3f51295d93ed6e27c3c6095c2), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`2889c7699`](https://github.com/bluesky-social/atproto/commit/2889c76995ce3c569f595ac3c678218e9ce659f0), [`5ece8c6ae`](https://github.com/bluesky-social/atproto/commit/5ece8c6aeab9c5c3f51295d93ed6e27c3c6095c2)]:
  - @atproto/jwk@0.1.2
  - @atproto/jwk-jose@0.1.3
  - @atproto-labs/fetch@0.2.0
  - @atproto/oauth-types@0.2.2
  - @atproto-labs/fetch-node@0.1.5

## 0.2.11

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.4.6

## 0.2.10

### Patch Changes

- Updated dependencies [[`588baae12`](https://github.com/bluesky-social/atproto/commit/588baae1212a3cba3bf0d95d2f268e80513fd9c4)]:
  - @atproto/common@0.4.5

## 0.2.9

### Patch Changes

- [#3135](https://github.com/bluesky-social/atproto/pull/3135) [`622654672`](https://github.com/bluesky-social/atproto/commit/6226546725d1bb0375e3c9e0d71af173e8253c4f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve "invalid_client_metadata" error description

- Updated dependencies [[`622654672`](https://github.com/bluesky-social/atproto/commit/6226546725d1bb0375e3c9e0d71af173e8253c4f)]:
  - @atproto-labs/fetch@0.1.2
  - @atproto-labs/fetch-node@0.1.4

## 0.2.8

### Patch Changes

- Updated dependencies [[`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3), [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3), [`5ddd51235`](https://github.com/bluesky-social/atproto/commit/5ddd51235c7e064bddcad2dd218df05d144d18d3)]:
  - @atproto/oauth-types@0.2.1

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
