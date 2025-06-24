# @atproto-labs/identity-resolver

## 0.3.0

### Minor Changes

- [#3982](https://github.com/bluesky-social/atproto/pull/3982) [`4c2d49917`](https://github.com/bluesky-social/atproto/commit/4c2d499178c61eb8a9d7f658e89fe68fa07f81e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Identity resolver's `resolve()` method returns value consistent with `com.atproto.identity.resolveIdentity`

- [#3982](https://github.com/bluesky-social/atproto/pull/3982) [`4c2d49917`](https://github.com/bluesky-social/atproto/commit/4c2d499178c61eb8a9d7f658e89fe68fa07f81e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - `IdentityResolver` is now an interface. The `IdentityResolverProto` class is the default implementation for the `IdentityResolver` interface.

### Patch Changes

- [#3982](https://github.com/bluesky-social/atproto/pull/3982) [`4c2d49917`](https://github.com/bluesky-social/atproto/commit/4c2d499178c61eb8a9d7f658e89fe68fa07f81e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export `HANDLE_INVALID` constant

## 0.2.0

### Minor Changes

- [#3977](https://github.com/bluesky-social/atproto/pull/3977) [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Return the whole did document when resolving an identity

- [#3977](https://github.com/bluesky-social/atproto/pull/3977) [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Reject did documents containing invalid `alsoKnownAs` ATProto handles

- [#3977](https://github.com/bluesky-social/atproto/pull/3977) [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `IdentityResolverError` instances instead of `TypeError`

### Patch Changes

- [#3977](https://github.com/bluesky-social/atproto/pull/3977) [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Perform a bi-directional check when resolving identity from did

- [#3977](https://github.com/bluesky-social/atproto/pull/3977) [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow non-normalized handles in did documents

- Updated dependencies [[`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47), [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47)]:
  - @atproto-labs/handle-resolver@0.3.0

## 0.1.19

### Patch Changes

- Updated dependencies [[`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee), [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee)]:
  - @atproto-labs/handle-resolver@0.2.0
  - @atproto-labs/did-resolver@0.2.0

## 0.1.18

### Patch Changes

- [#3933](https://github.com/bluesky-social/atproto/pull/3933) [`192f3ab89`](https://github.com/bluesky-social/atproto/commit/192f3ab89c943216683541f42cc1332e9c305eee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Return atproto handle in identity resolution result

## 0.1.17

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/did-resolver@0.1.13

## 0.1.16

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/did-resolver@0.1.12
  - @atproto-labs/handle-resolver@0.1.8

## 0.1.15

### Patch Changes

- Updated dependencies [[`670b6b5de`](https://github.com/bluesky-social/atproto/commit/670b6b5de2bf91e6944761c98eb1126fb6a681ee)]:
  - @atproto/syntax@0.4.0

## 0.1.14

### Patch Changes

- Updated dependencies [[`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29)]:
  - @atproto/syntax@0.3.4
  - @atproto-labs/did-resolver@0.1.11

## 0.1.13

### Patch Changes

- Updated dependencies [[`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c)]:
  - @atproto/syntax@0.3.3

## 0.1.12

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto-labs/handle-resolver@0.1.7
  - @atproto-labs/did-resolver@0.1.10
  - @atproto/syntax@0.3.2

## 0.1.11

### Patch Changes

- Updated dependencies [[`cc2a1222b`](https://github.com/bluesky-social/atproto/commit/cc2a1222bd2b8ddd70d70dad174c1c63246a2d87)]:
  - @atproto-labs/did-resolver@0.1.9
  - @atproto-labs/handle-resolver@0.1.6

## 0.1.10

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/did-resolver@0.1.8

## 0.1.9

### Patch Changes

- Updated dependencies [[`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99)]:
  - @atproto-labs/did-resolver@0.1.7

## 0.1.8

### Patch Changes

- Updated dependencies [[`a200e5095`](https://github.com/bluesky-social/atproto/commit/a200e50951d297c3f9670e96027262196bc29b0b)]:
  - @atproto-labs/handle-resolver@0.1.5

## 0.1.7

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/did-resolver@0.1.6

## 0.1.6

### Patch Changes

- Updated dependencies [[`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d)]:
  - @atproto/syntax@0.3.1

## 0.1.5

### Patch Changes

- Updated dependencies [[`7f26b1765`](https://github.com/bluesky-social/atproto/commit/7f26b176526b9856a8f61faca6f065f0afd43abf), [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2)]:
  - @atproto-labs/did-resolver@0.1.5
  - @atproto-labs/handle-resolver@0.1.4

## 0.1.4

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/did-resolver@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - @atproto-labs/did-resolver@0.1.3
  - @atproto-labs/handle-resolver@0.1.3

## 0.1.2

### Patch Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose getDocumentFromDid and getDocumentFromHandle as public methods on IdentityResolver

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd)]:
  - @atproto-labs/handle-resolver@0.1.2
  - @atproto-labs/did-resolver@0.1.2

## 0.1.1

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use distinct type names to prevent conflicts

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto-labs/handle-resolver@0.1.1
  - @atproto-labs/did-resolver@0.1.1

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens

### Patch Changes

- Updated dependencies [[`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646)]:
  - @atproto-labs/handle-resolver@0.1.0
  - @atproto-labs/did-resolver@0.1.0
