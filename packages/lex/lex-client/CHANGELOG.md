# @atproto/lex-client

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
