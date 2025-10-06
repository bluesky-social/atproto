# @atproto-labs/handle-resolver

## 0.3.2

### Patch Changes

- Updated dependencies [[`09439d7d6`](https://github.com/bluesky-social/atproto/commit/09439d7d688294ad1a0c78a74b901ba2f7c5f4c3)]:
  - @atproto/did@0.2.1

## 0.3.1

### Patch Changes

- Updated dependencies [[`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d), [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d)]:
  - @atproto/did@0.2.0
  - @atproto-labs/simple-store@0.3.0
  - @atproto-labs/simple-store-memory@0.1.4

## 0.3.0

### Minor Changes

- [#3977](https://github.com/bluesky-social/atproto/pull/3977) [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `HandleResolverError` instances instead of `TypeError`

### Patch Changes

- [#3977](https://github.com/bluesky-social/atproto/pull/3977) [`9dac8b0c6`](https://github.com/bluesky-social/atproto/commit/9dac8b0c600520ecb0066ac104787b27668dea47) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export `asResolvedHandle` utility

## 0.2.0

### Minor Changes

- [#3976](https://github.com/bluesky-social/atproto/pull/3976) [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `AppViewHandleResolver` to `XrpcHandleResolver`

- [#3976](https://github.com/bluesky-social/atproto/pull/3976) [`90b4775fc`](https://github.com/bluesky-social/atproto/commit/90b4775fc9c6959171bc12b961ce9421cc14d6ee) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `XrpcHandleResolver.from` static method

## 0.1.8

### Patch Changes

- Updated dependencies [[`0d77d1b55`](https://github.com/bluesky-social/atproto/commit/0d77d1b550a58117aee8f7f1e2be24d255ade9e4), [`0d77d1b55`](https://github.com/bluesky-social/atproto/commit/0d77d1b550a58117aee8f7f1e2be24d255ade9e4)]:
  - @atproto-labs/simple-store@0.2.0
  - @atproto-labs/simple-store-memory@0.1.3

## 0.1.7

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd)]:
  - @atproto-labs/simple-store-memory@0.1.2
  - @atproto-labs/simple-store@0.1.2
  - @atproto/did@0.1.5

## 0.1.6

### Patch Changes

- Updated dependencies [[`cc2a1222b`](https://github.com/bluesky-social/atproto/commit/cc2a1222bd2b8ddd70d70dad174c1c63246a2d87)]:
  - @atproto/did@0.1.4

## 0.1.5

### Patch Changes

- [#3046](https://github.com/bluesky-social/atproto/pull/3046) [`a200e5095`](https://github.com/bluesky-social/atproto/commit/a200e50951d297c3f9670e96027262196bc29b0b) Thanks [@sgarciac](https://github.com/sgarciac)! - This change makes the DoH handle resolver accept a wider range of content types for DoH API calls.

  While there is no agreed upon MIME type for DoH's JSON Schema, this change supports a reasonable
  set that include those used by major DoH providers such as Google and Cloudflare.

## 0.1.4

### Patch Changes

- [#2871](https://github.com/bluesky-social/atproto/pull/2871) [`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use fetch()'s "cache" option instead of headers to force caching behavior

- Updated dependencies [[`9d40ccbb6`](https://github.com/bluesky-social/atproto/commit/9d40ccbb69103fae9aae7e3cec31e9b3116f3ba2)]:
  - @atproto/did@0.1.3

## 0.1.3

### Patch Changes

- Updated dependencies [[`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c), [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c), [`cb4abbb67`](https://github.com/bluesky-social/atproto/commit/cb4abbb673c69a8a89b49dca5c038f3da2153c6c)]:
  - @atproto/did@0.1.2

## 0.1.2

### Patch Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Updated to use "AtprotoDid" utils from @atproto/did

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd)]:
  - @atproto/did@0.1.1

## 0.1.1

### Patch Changes

- [#2633](https://github.com/bluesky-social/atproto/pull/2633) [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use distinct type names to prevent conflicts

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10), [`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto-labs/simple-store@0.1.1
  - @atproto-labs/simple-store-memory@0.1.1

## 0.1.0

### Minor Changes

- [#2482](https://github.com/bluesky-social/atproto/pull/2482) [`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add OAuth provider capability & support for DPoP signed tokens

### Patch Changes

- Updated dependencies [[`a8d6c1123`](https://github.com/bluesky-social/atproto/commit/a8d6c112359f5c4c0cfbe2df63443ed275f2a646)]:
  - @atproto-labs/simple-store-memory@0.1.0
  - @atproto-labs/simple-store@0.1.0
  - @atproto/did@0.1.0
