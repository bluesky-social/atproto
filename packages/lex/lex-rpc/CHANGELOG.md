# @atproto/lex-rpc

## 0.3.0

### Minor Changes

- [#6020](https://github.com/bluesky-social/atproto/pull/6020) [`58ca16d`](https://github.com/bluesky-social/atproto/commit/58ca16d32ccb50b30e1d4c800c6263af7511a4ff) Thanks [@matthieusieben](https://github.com/matthieusieben)! - **Breaking:** `applyDefaults`, `asUint8ArrayArrayBuffer`, `canParseUrl`, `isAsyncIterable`, `isBlobLike`, `toReadableStream`, `toReadableStreamPonyfill`, `trim`, `wait` and the `WithDefaults` type are no longer exported from `@atproto/lex-rpc`, nor re-exported from `@atproto/lex-client` and `@atproto/lex`.

### Patch Changes

- [#6019](https://github.com/bluesky-social/atproto/pull/6019) [`315aba7`](https://github.com/bluesky-social/atproto/commit/315aba7d157f2e7376b56e927e9bc088a3a622c1) Thanks [@matthieusieben](https://github.com/matthieusieben)! - `XrpcFetchError` is no longer retryable when Node.js' `fetch()` reports a failure that a retry cannot fix, such as a refused redirect (`redirect: "error"`), too many redirects, an unknown host or an invalid TLS certificate.

- [#6019](https://github.com/bluesky-social/atproto/pull/6019) [`315aba7`](https://github.com/bluesky-social/atproto/commit/315aba7d157f2e7376b56e927e9bc088a3a622c1) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add a `redirect` option to XRPC requests and to the `Client` constructor, setting the redirect mode passed to `fetch()` (still `"follow"` by default).

- [#6020](https://github.com/bluesky-social/atproto/pull/6020) [`58ca16d`](https://github.com/bluesky-social/atproto/commit/58ca16d32ccb50b30e1d4c800c6263af7511a4ff) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Ensure that abort errors have a `name` property on platforms that don't provide a DOMException class
- Updated dependencies [[`2ed73cc`](https://github.com/bluesky-social/atproto/commit/2ed73cc657769447d2617f1c3642b06f69b69dc5)]:
  - @atproto/lex-schema@0.3.2

## 0.2.2

### Patch Changes

- Updated dependencies [[`9901412`](https://github.com/bluesky-social/atproto/commit/9901412468741c11399c130a39aa44bc7dd06cb8)]:
  - @atproto/lex-json@0.1.11

## 0.2.1

### Patch Changes

- Updated dependencies [[`ee63e5e`](https://github.com/bluesky-social/atproto/commit/ee63e5ede255e40251a9e761befec9d623dfb1ec)]:
  - @atproto/lex-schema@0.3.1

## 0.2.0

### Minor Changes

- [#5885](https://github.com/bluesky-social/atproto/pull/5885) [`6ee0f4d`](https://github.com/bluesky-social/atproto/commit/6ee0f4d7971dcc71efaab785aff4d4ef341a1c32) Thanks [@matthieusieben](https://github.com/matthieusieben)! - **Breaking:** `RETRYABLE_HTTP_STATUS_CODES` is now a frozen, literal-typed array instead of a `ReadonlySet<number>`. Replace `RETRYABLE_HTTP_STATUS_CODES.has(status)` with the new `isRetryableHttpStatus(status)` type guard (narrowing to the new `RetryableHttpStatus` type).
  
  Also add `RETRYABLE_ERROR_CODES` and its `isRetryableErrorCode()` type guard (the XRPC error codes matching a retryable HTTP status, for classifying an error by code alone), and `getStatusErrorCode()`, mapping an HTTP status to the XRPC error code used for non-XRPC error responses.

- [#5948](https://github.com/bluesky-social/atproto/pull/5948) [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - **Breaking:** `validateRequest: false` now also skips validating an XRPC request's params and applying their defaults, which are then sent as given. Since `Client` defaults `validateRequest` to `false`, its requests no longer validate params unless `validateRequest` is set.

- [#5948](https://github.com/bluesky-social/atproto/pull/5948) [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow the per-request `headers` option to be a (sync or async) function, called for every attempt (retries included). The client-wide `headers` (`ClientOptions`) still only accept a `HeadersInit`.
  
  **Breaking**: `buildXrpcRequestHeaders()` is now async (returns a `Promise<Headers>`), and code reading the `headers` of `XrpcRequestHeadersOptions` (thus of `XrpcOptions`) must handle a function.

### Patch Changes

- [#5948](https://github.com/bluesky-social/atproto/pull/5948) [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add the `isAccountAgent()` type guard, which tells whether an `Agent` is an `AccountAgent` (i.e. has a `did`).

- [#5950](https://github.com/bluesky-social/atproto/pull/5950) [`b9b1ca7`](https://github.com/bluesky-social/atproto/commit/b9b1ca7f176b93d12e39685799c5f2e1f9a63be7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update `vitest` to v5, `vite` to v8.3.8 and `rolldown` to v1.3.3 (dev dependencies)

- [#5948](https://github.com/bluesky-social/atproto/pull/5948) [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - A `headers` function option may return `undefined`, and `mergeHeaders()` accepts omitted request headers.

- [#5885](https://github.com/bluesky-social/atproto/pull/5885) [`6ee0f4d`](https://github.com/bluesky-social/atproto/commit/6ee0f4d7971dcc71efaab785aff4d4ef341a1c32) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add XRPC subscription support with `xrpcSubscribe(agent, ns, options)`, exported by the new `@atproto/lex-rpc/subscription` entrypoint: an async generator of the subscription's messages, validated against its message schema. Failures are reported as `XrpcSubscriptionError` subclasses, and `isRetryableSubscriptionError()` classifies them for a reconnect policy.
  
  Subscriptions connect through the new optional `Agent.websocketHandler`. `buildAgent()` creates one from the new `AgentConfig.websocket` option, a `fetch`-like function called with the `ws(s)` URL of the `service` and the agent's `headers`. The `@atproto/lex-rpc/subscription` entrypoint also exports `createWebSocketFactory(options)`, creating one over `@atproto/ws-client` with the given connection options, and `defaultWebsocket`, created with the default options, which `xrpcSubscribe()` uses when given a service URL, or an `AgentConfig` without its own `websocket`. Both reconnect per `defaultSubscriptionShouldReconnect()`, which extends `@atproto/ws-client`'s `defaultShouldReconnect()` with `isRetryableSubscriptionError()`.
  
  The `params` option of `xrpc()`, `xrpcSafe()` and `xrpcSubscribe()` also accepts a (possibly async) function returning the params, invoked for every attempt (each retry, each subscription reconnection).
- Updated dependencies [[`b9b1ca7`](https://github.com/bluesky-social/atproto/commit/b9b1ca7f176b93d12e39685799c5f2e1f9a63be7), [`6ee0f4d`](https://github.com/bluesky-social/atproto/commit/6ee0f4d7971dcc71efaab785aff4d4ef341a1c32), [`118a827`](https://github.com/bluesky-social/atproto/commit/118a82770430c01ed47ded26569fffcbd68afcf4), [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd), [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd), [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd), [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd), [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd), [`ce37237`](https://github.com/bluesky-social/atproto/commit/ce37237663b7ea87e8cc04cb995377d0ee5d2efd), [`6ee0f4d`](https://github.com/bluesky-social/atproto/commit/6ee0f4d7971dcc71efaab785aff4d4ef341a1c32), [`6ee0f4d`](https://github.com/bluesky-social/atproto/commit/6ee0f4d7971dcc71efaab785aff4d4ef341a1c32)]:
  - @atproto/lex-cbor@0.1.11
  - @atproto/lex-data@0.1.11
  - @atproto/lex-json@0.1.10
  - @atproto/lex-schema@0.3.0
  - @atproto/ws-client@0.2.2

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
