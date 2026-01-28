# @atproto/did

## 0.3.0

### Minor Changes

- [#4580](https://github.com/bluesky-social/atproto/pull/4580) [`d54d707`](https://github.com/bluesky-social/atproto/commit/d54d7077eb32041e1f61c312efa1dd0d768c774e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow DID document to omit the `@context` root property

- [#4580](https://github.com/bluesky-social/atproto/pull/4580) [`d54d707`](https://github.com/bluesky-social/atproto/commit/d54d7077eb32041e1f61c312efa1dd0d768c774e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Disallow string values in `verificationMethod` array (as per spec)

## 0.2.4

### Patch Changes

- [#4501](https://github.com/bluesky-social/atproto/pull/4501) [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose new `AtprotoDidDocument` type

## 0.2.3

### Patch Changes

- [#4383](https://github.com/bluesky-social/atproto/pull/4383) [`8012627`](https://github.com/bluesky-social/atproto/commit/8012627a1226cb2f1c753385ad2497b6b43ffd2e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export `AtprotoData` type

- [#4384](https://github.com/bluesky-social/atproto/pull/4384) [`d396de0`](https://github.com/bluesky-social/atproto/commit/d396de016d1d55d08cfad1dabd3ffd9eaeea76ea) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose `matchesIdentifier` and `extractAtprotoData` utilities.

## 0.2.2

### Patch Changes

- [#4366](https://github.com/bluesky-social/atproto/pull/4366) [`261968fd6`](https://github.com/bluesky-social/atproto/commit/261968fd65014ded613e2bf085d61a7864b8fba7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `extractPdsUrl` utility

## 0.2.1

### Patch Changes

- [#4216](https://github.com/bluesky-social/atproto/pull/4216) [`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Minor typing improvements

## 0.2.0

### Minor Changes

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Enforce proper formatting of relative uris fragments

### Patch Changes

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export `AtprotoAudience` type and validation function

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Small performance improvement

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Small performance improvement

## 0.1.5

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

## 0.1.4

### Patch Changes

- [#3454](https://github.com/bluesky-social/atproto/pull/3454) [`cc2a1222b`](https://github.com/bluesky-social/atproto/commit/cc2a1222bd2b8ddd70d70dad174c1c63246a2d87) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix encoding and decoding of did:web

## 0.1.3

### Patch Changes

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add atprotoDidSchema to validate Atproto supported DID's using zod

## 0.1.2

### Patch Changes

- [#2776](https://github.com/bluesky-social/atproto/pull/2776) [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Disallow path component in Web DID's (as per spec)

- [#2776](https://github.com/bluesky-social/atproto/pull/2776) [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly parse localhost did:web

- [#2776](https://github.com/bluesky-social/atproto/pull/2776) [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Code optimizations and documentation. Rename `check*` utility function to `assert*`.

## 0.1.1

### Patch Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose atproto specific types and utilities

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens
