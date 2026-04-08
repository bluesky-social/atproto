# @atproto/lex-client

## 0.0.19

### Patch Changes

- [#4839](https://github.com/bluesky-social/atproto/pull/4839) [`b6b231f`](https://github.com/bluesky-social/atproto/commit/b6b231f9c05cf90239d4a29aa0ae2592ea5ce928) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix typing of `delete` options to omit `body` instead of `params`.

- [#4828](https://github.com/bluesky-social/atproto/pull/4828) [`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Accept legacy blob references in non-strict mode. Legacy blob references (objects with `cid` and `mimeType` properties) are now accepted when `strict: false`, which is the default behavior when `strictResponseProcessing` is disabled on the Client.

  BREAKING: The `allowLegacy` option has been removed from the blob schema builder, and legacy blobs are now handled automatically based on the strictness mode: in strict mode they are rejected, and in non-strict mode they are accepted. Consumers should stop passing `allowLegacy` and rely on strictness configuration instead. Likewise, CLI consumers should stop using the removed `--allowLegacyBlobs` flag and use the default strict/non-strict behavior.

- [#4835](https://github.com/bluesky-social/atproto/pull/4835) [`f6f100c`](https://github.com/bluesky-social/atproto/commit/f6f100c33700a7ff58a1458109cc7420131feed0) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `lexParseJsonBytes` to convert binary data directly into lex value

- Updated dependencies [[`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856), [`f6f100c`](https://github.com/bluesky-social/atproto/commit/f6f100c33700a7ff58a1458109cc7420131feed0), [`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856), [`c62651d`](https://github.com/bluesky-social/atproto/commit/c62651dd69f1e18bd854b66e499b91fee9eaa856), [`f6f100c`](https://github.com/bluesky-social/atproto/commit/f6f100c33700a7ff58a1458109cc7420131feed0)]:
  - @atproto/lex-data@0.0.15
  - @atproto/lex-schema@0.0.18
  - @atproto/lex-json@0.0.15

## 0.0.18

### Patch Changes

- [#4779](https://github.com/bluesky-social/atproto/pull/4779) [`527f5d4`](https://github.com/bluesky-social/atproto/commit/527f5d4c5d0c9264c2ff6f23ad06a41163fc6809) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve handling of XRPC response errors by always using `XrpcResponseError` errors when upstream server responds with an error status code. Before, `XrpcResponseError` would only be used if the upstream server responded with a valid XRPC payload (json with `error` field). Any other response payload (e.g. non-json, invalid "error" payload) would be treated as the upstream server not being able to output a valid XRPC response, and would throw `XrpcUpstreamError` instead. This change allows to better reflect upstream server errors to downstream services (eg. return a 429 if the upstream server responds with a 429 status code, instead of a 502, even if the response payload is not a valid XRPC error payload).

  `XrpcUpstreamError` was removed and replaced with `XrpcInvalidResponseError` to better reflect the intent to those errors (invalid status code, non-json, or invalid payload). `XrpcResponseValidationError` is a special case of `XrpcInvalidResponseError` that is thrown when the response does not conform to the expected XRPC output schema.

- [#4788](https://github.com/bluesky-social/atproto/pull/4788) [`a99dd58`](https://github.com/bluesky-social/atproto/commit/a99dd58b5fe1995e571cf5e7b0105355583efa93) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow XRPC endpoints with no `output` specified in their schema to output anything.

- Updated dependencies [[`527f5d4`](https://github.com/bluesky-social/atproto/commit/527f5d4c5d0c9264c2ff6f23ad06a41163fc6809), [`c4df84c`](https://github.com/bluesky-social/atproto/commit/c4df84cd78df68ee8cb7289e7b61b3a032ad484e), [`527f5d4`](https://github.com/bluesky-social/atproto/commit/527f5d4c5d0c9264c2ff6f23ad06a41163fc6809), [`e5e5bcf`](https://github.com/bluesky-social/atproto/commit/e5e5bcf85fbc0d418f05724d684e7265be6a0be9), [`ac6bd18`](https://github.com/bluesky-social/atproto/commit/ac6bd18f1dc3397dd29008eff2a1e40702a4e138), [`c5c6c7d`](https://github.com/bluesky-social/atproto/commit/c5c6c7dac3b08e5f63cc918f57705573028ad797)]:
  - @atproto/lex-schema@0.0.17

## 0.0.17

### Patch Changes

- [#4761](https://github.com/bluesky-social/atproto/pull/4761) [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix `XrpcResponse.payload` to be typed as the schema's parse "Output"

- [#4761](https://github.com/bluesky-social/atproto/pull/4761) [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow defining request and response processing defaults on the `Client` instance

- [#4773](https://github.com/bluesky-social/atproto/pull/4773) [`df8328c`](https://github.com/bluesky-social/atproto/commit/df8328c3c2f211fe16ccf58fa9f3968465cbf2b0) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `XrpcParamsOptions` as `XrpcRequestParamsOptions`

- [#4761](https://github.com/bluesky-social/atproto/pull/4761) [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to process invalid Lexicon Data responses (instead of rejecting them as invalid)

- [#4761](https://github.com/bluesky-social/atproto/pull/4761) [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow using a dynamic non-strict validation mode

- Updated dependencies [[`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786), [`6a88461`](https://github.com/bluesky-social/atproto/commit/6a88461c5aa9486269f0769b7a3d52f384581786)]:
  - @atproto/lex-schema@0.0.16
  - @atproto/lex-data@0.0.14
  - @atproto/lex-json@0.0.14

## 0.0.16

### Patch Changes

- [#4714](https://github.com/bluesky-social/atproto/pull/4714) [`5a2f884`](https://github.com/bluesky-social/atproto/commit/5a2f8847efd91252971fa243d21bd52ada7aa8f4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Create a specific error class for wrapping unexpected error returned by the `fetchHandler`. This allows to better distinguish unexpected internal server errors (due to implementation encountering an unexpected case) from potentially transient errors that occur when performing network HTTP requests.

- Updated dependencies [[`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`112b159`](https://github.com/bluesky-social/atproto/commit/112b159ec293a5c3fff41237474a3788fc47f9ca), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe), [`3dc3791`](https://github.com/bluesky-social/atproto/commit/3dc37915436dec7e18c7dc9dcf01b72cad53fdbe)]:
  - @atproto/lex-schema@0.0.15

## 0.0.15

### Patch Changes

- [#4688](https://github.com/bluesky-social/atproto/pull/4688) [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update error management to be more aligned with the way errors work in `@atproto/xrpc` and `@atproto/xrpc-server`

- [#4688](https://github.com/bluesky-social/atproto/pull/4688) [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add dedicated `XrpcInvalidResponseError` error for responses that don't match the schema

- [#4688](https://github.com/bluesky-social/atproto/pull/4688) [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `matchesSchema` to `matchesSchemaErrors` to make it more explicit what is being matched when called on an XRPC "result" (that could either represent a success or failure)

- Updated dependencies [[`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7), [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7)]:
  - @atproto/lex-schema@0.0.14
  - @atproto/lex-data@0.0.13
  - @atproto/lex-json@0.0.13

## 0.0.14

### Patch Changes

- [#4672](https://github.com/bluesky-social/atproto/pull/4672) [`38852f0`](https://github.com/bluesky-social/atproto/commit/38852f0ddfa9fbce8036233dc6af87614e9ae4b2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow calling `xrpc` and `xrpcSafe` functions with a service URL

## 0.0.13

### Patch Changes

- Updated dependencies [[`39dea03`](https://github.com/bluesky-social/atproto/commit/39dea03c417a1da069962560505427a7aa25ad7a), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`39dea03`](https://github.com/bluesky-social/atproto/commit/39dea03c417a1da069962560505427a7aa25ad7a), [`39dea03`](https://github.com/bluesky-social/atproto/commit/39dea03c417a1da069962560505427a7aa25ad7a), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`39dea03`](https://github.com/bluesky-social/atproto/commit/39dea03c417a1da069962560505427a7aa25ad7a), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df), [`ea5df64`](https://github.com/bluesky-social/atproto/commit/ea5df64db9e408d2b320f5f75eb2878aef6bc6df)]:
  - @atproto/lex-schema@0.0.13
  - @atproto/lex-data@0.0.12
  - @atproto/lex-json@0.0.12

## 0.0.12

### Patch Changes

- [#4601](https://github.com/bluesky-social/atproto/pull/4601) [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add missing exports

- [#4601](https://github.com/bluesky-social/atproto/pull/4601) [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix `exports` field in package.json

- [#4601](https://github.com/bluesky-social/atproto/pull/4601) [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add JSDoc

- [#4601](https://github.com/bluesky-social/atproto/pull/4601) [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add JSDoc to `Client` class properties and methods

- Updated dependencies [[`7b9a98a`](https://github.com/bluesky-social/atproto/commit/7b9a98a763636c5f66a06da11fe6013f29dd9157), [`7b9a98a`](https://github.com/bluesky-social/atproto/commit/7b9a98a763636c5f66a06da11fe6013f29dd9157), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015), [`7b9a98a`](https://github.com/bluesky-social/atproto/commit/7b9a98a763636c5f66a06da11fe6013f29dd9157), [`7b9a98a`](https://github.com/bluesky-social/atproto/commit/7b9a98a763636c5f66a06da11fe6013f29dd9157), [`ed61c62`](https://github.com/bluesky-social/atproto/commit/ed61c62f3161fcde85ee9a93f8ed339c7e06c015)]:
  - @atproto/lex-schema@0.0.12
  - @atproto/lex-json@0.0.11
  - @atproto/lex-data@0.0.11

## 0.0.11

### Patch Changes

- [#4589](https://github.com/bluesky-social/atproto/pull/4589) [`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to set default `headers` when creating XRPC agent

- [#4589](https://github.com/bluesky-social/atproto/pull/4589) [`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve typing of error responses

- [#4589](https://github.com/bluesky-social/atproto/pull/4589) [`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow omitting `rkey` for record definition usin `any`as record key

- Updated dependencies [[`369bb02`](https://github.com/bluesky-social/atproto/commit/369bb02b9f80f0e15e5242e54f09bd4e01117f3a)]:
  - @atproto/lex-data@0.0.10
  - @atproto/lex-json@0.0.10
  - @atproto/lex-schema@0.0.11

## 0.0.10

### Patch Changes

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `LexRpcFailure` to `XrpcFailure`, `LexRpcOptions` to `XrpcOptions`, `LexRpcResponse` to `XrpcResponse`, `LexRpcResponseBody` to `XrpcResponseBody`

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove dependency on `URLSearchParams.size` when building XRPC request query string

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `Payload` to `XrpcPayload`

- Updated dependencies [[`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`aaedafc`](https://github.com/bluesky-social/atproto/commit/aaedafc6baef106b85e0954d8474cec21c00c1c2), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b)]:
  - @atproto/lex-schema@0.0.10
  - @atproto/lex-json@0.0.9
  - @atproto/lex-data@0.0.9

## 0.0.9

### Patch Changes

- Updated dependencies [[`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e), [`dfd4bee`](https://github.com/bluesky-social/atproto/commit/dfd4bee4abbc1a3e53531bb499a6f3169c13ed9e)]:
  - @atproto/lex-data@0.0.8
  - @atproto/lex-json@0.0.8
  - @atproto/lex-schema@0.0.9

## 0.0.8

### Patch Changes

- Updated dependencies [[`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe), [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe)]:
  - @atproto/lex-data@0.0.7
  - @atproto/lex-schema@0.0.8
  - @atproto/lex-json@0.0.7

## 0.0.7

### Patch Changes

- [#4501](https://github.com/bluesky-social/atproto/pull/4501) [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98) Thanks [@matthieusieben](https://github.com/matthieusieben)! - **breaking:** Use a record type (`com.example.record.Main`) instead of a record schema type (`typeof com.example.record.$defs.main`) as the generic parameter for `ListRecord`.

- Updated dependencies [[`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98)]:
  - @atproto/lex-data@0.0.6
  - @atproto/lex-schema@0.0.7
  - @atproto/lex-json@0.0.6

## 0.0.6

### Patch Changes

- [#4443](https://github.com/bluesky-social/atproto/pull/4443) [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rework `XrpcError` to extend `LexError` from `@atproto/data`

- [#4443](https://github.com/bluesky-social/atproto/pull/4443) [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose `asXrpcFailure` utility

- [#4443](https://github.com/bluesky-social/atproto/pull/4443) [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - `buildAgent` can now be given an `Agent` as input (and will act as identity in that case)

- Updated dependencies [[`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c), [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c)]:
  - @atproto/lex-schema@0.0.6
  - @atproto/lex-data@0.0.5
  - @atproto/lex-json@0.0.5

## 0.0.5

### Patch Changes

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Complete rework of the error mechanics

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for `uploadBlob` and `getBlob` methods

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Validate records when `validateRequest` is set when calling `create` and `put` methods.

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export `FetchHandler` as a distinct type

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - No longer validate records when `validate` option is set in `create()` method. Use `validateRequest` option for that purpose.

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `XrpcFailure` error name field to `error` for consistency with XRPC error payloads

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow specifying request content-type through the `encoding` option

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve handling of binary payloads

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `createRecordsSafe`, `deleteRecordsSafe`, `getRecordsSafe` and `putRecordsSafe` methods

- Updated dependencies [[`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece), [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece)]:
  - @atproto/lex-data@0.0.4
  - @atproto/lex-schema@0.0.5
  - @atproto/lex-json@0.0.4

## 0.0.4

### Patch Changes

- Updated dependencies [[`693784c`](https://github.com/bluesky-social/atproto/commit/693784c3a0dee4b6a29aa1e018fce682dcae148f)]:
  - @atproto/lex-data@0.0.3
  - @atproto/lex-json@0.0.3
  - @atproto/lex-schema@0.0.4

## 0.0.3

### Patch Changes

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rework object validation logic to work without `options` argument

- [#4405](https://github.com/bluesky-social/atproto/pull/4405) [`2d13d05`](https://github.com/bluesky-social/atproto/commit/2d13d05ab06576703742b1b638d2f243b6b2915f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow `.call()` argument "`params`" to be `undefined` when all params are optional

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace use of `CID` with `Cid`

- [#4389](https://github.com/bluesky-social/atproto/pull/4389) [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use string formats from `@atproto/syntax`

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename schema methods `validate`, `check` and `maybe` to `safeParse`, `matches` and `ifMatches` respectively.

- [#4397](https://github.com/bluesky-social/atproto/pull/4397) [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `CHANGELOG.md` to npm package

- Updated dependencies [[`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`9f87ff3`](https://github.com/bluesky-social/atproto/commit/9f87ff3aa60090c8c38b6ce400cba6ceff5cd2e9), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba)]:
  - @atproto/lex-schema@0.0.3
  - @atproto/lex-data@0.0.2
  - @atproto/lex-json@0.0.2

## 0.0.2

### Patch Changes

- Updated dependencies [[`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4)]:
  - @atproto/lex-schema@0.0.2

## 0.0.1

### Patch Changes

- [#4371](https://github.com/bluesky-social/atproto/pull/4371) [`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Release

- Updated dependencies [[`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af)]:
  - @atproto/lex-data@0.0.1
  - @atproto/lex-json@0.0.1
  - @atproto/lex-schema@0.0.1
