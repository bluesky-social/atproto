# @atproto/lex-rpc

## 0.1.0

### Minor Changes

- [#5917](https://github.com/bluesky-social/atproto/pull/5917) [`b5dfe0b`](https://github.com/bluesky-social/atproto/commit/b5dfe0b80ac4f14f56b3c9b797e0e50d2e194a3b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - **Breaking:** the response payload of methods without a declared output encoding is no longer parsed as JSON. It is returned as binary data (a `Uint8Array`, or a `ReadableStream` with `xrpcStream()`), or `undefined` when there is none, and callers that expect JSON must parse it themselves (e.g. `lexParse(new TextDecoder().decode(body))`). Only `application/json` outputs, and outputs with a schema, are parsed.

### Patch Changes

- [#5917](https://github.com/bluesky-social/atproto/pull/5917) [`b5dfe0b`](https://github.com/bluesky-social/atproto/commit/b5dfe0b80ac4f14f56b3c9b797e0e50d2e194a3b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix `ReferenceError`s in environments that do not define a `ReadableStream` global (e.g. React Native), when sending `Blob` request bodies, when processing failed requests, and when refreshing expired password sessions.

- [#5917](https://github.com/bluesky-social/atproto/pull/5917) [`b5dfe0b`](https://github.com/bluesky-social/atproto/commit/b5dfe0b80ac4f14f56b3c9b797e0e50d2e194a3b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `xrpcStream()` / `xrpcStreamSafe()` (and `Client.xrpcStream()`, `Client.xrpcStreamSafe()`, `Client.getBlobStream()`), returning binary response payloads as an unread `ReadableStream` through a disposable `XrpcStreamResponse`. Response bodies are now always released (cancelled) when response processing fails, as configured by the new `onCancellationError` response option (defaults to `"propagate"`).

## 0.0.3

### Patch Changes

- Updated dependencies [[`8c841f6`](https://github.com/bluesky-social/atproto/commit/8c841f6e73c8365c2dfe816c0613aa9c50490361), [`8c841f6`](https://github.com/bluesky-social/atproto/commit/8c841f6e73c8365c2dfe816c0613aa9c50490361), [`8c841f6`](https://github.com/bluesky-social/atproto/commit/8c841f6e73c8365c2dfe816c0613aa9c50490361), [`8c841f6`](https://github.com/bluesky-social/atproto/commit/8c841f6e73c8365c2dfe816c0613aa9c50490361)]:
  - @atproto/lex-data@0.1.10
  - @atproto/lex-schema@0.2.11
  - @atproto/lex-json@0.1.9

## 0.0.2

### Patch Changes

- Updated dependencies [[`07c25d4`](https://github.com/bluesky-social/atproto/commit/07c25d410d4f4ad8f6ec80fc14efa0dd8ec55545), [`07c25d4`](https://github.com/bluesky-social/atproto/commit/07c25d410d4f4ad8f6ec80fc14efa0dd8ec55545)]:
  - @atproto/lex-data@0.1.9
  - @atproto/lex-json@0.1.8
  - @atproto/lex-schema@0.2.10

## 0.0.1

### Patch Changes

- [#5591](https://github.com/bluesky-social/atproto/pull/5591) [`f98b78a`](https://github.com/bluesky-social/atproto/commit/f98b78adbc8963e49823117b007422211f6d3ff2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Initial release
- Updated dependencies [[`f98b78a`](https://github.com/bluesky-social/atproto/commit/f98b78adbc8963e49823117b007422211f6d3ff2)]:
  - @atproto/lex-schema@0.2.9
