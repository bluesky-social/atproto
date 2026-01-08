# @atproto/lex-data

## 0.0.7

### Patch Changes

- [#4512](https://github.com/bluesky-social/atproto/pull/4512) [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe) Thanks [@matthieusieben](https://github.com/matthieusieben)! - **breaking**: replace `strict` options with `flavor` checking when parsing/decoding/validating `Cid` values

- [#4512](https://github.com/bluesky-social/atproto/pull/4512) [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose CID creation and validation utilities

- [#4512](https://github.com/bluesky-social/atproto/pull/4512) [`d78484f`](https://github.com/bluesky-social/atproto/commit/d78484f94d8ba1352ec66030115000d515c9dafe) Thanks [@matthieusieben](https://github.com/matthieusieben)! - **breaking**: `asCid` now throws if the input cannot be cast into a `Cid`

## 0.0.6

### Patch Changes

- [#4501](https://github.com/bluesky-social/atproto/pull/4501) [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `enumBlobRefs` utility function

- [#4501](https://github.com/bluesky-social/atproto/pull/4501) [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Perform strict `BlobRef` validation by default

- [#4501](https://github.com/bluesky-social/atproto/pull/4501) [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `base64ToUtf8` and `utf8ToBase64` utilities

## 0.0.5

### Patch Changes

- [#4443](https://github.com/bluesky-social/atproto/pull/4443) [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `LexErrorData` type, and an `LexError` class to represent structured error information

- [#4443](https://github.com/bluesky-social/atproto/pull/4443) [`9af7a2d`](https://github.com/bluesky-social/atproto/commit/9af7a2d12240e91248610ce4fe7d93387733c59c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `ui8Concat` utility for concatenating `Uint8Array`s

## 0.0.4

### Patch Changes

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use stack based approach in `isLexValue` allowing to be called with very deep structures;

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Do not throw an error from `isLexScalar` (return `false` instead)

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Forbid use of unsafe integers

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose `isPlainProto` utility to check if an object is a plain object.

- [#4457](https://github.com/bluesky-social/atproto/pull/4457) [`e6b6107`](https://github.com/bluesky-social/atproto/commit/e6b6107e028fee964972274b71f5da1329a7bece) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename `parseLanguage` and `isLanguage` exports to `parseLanguageString` and `isLanguageString` respectively

## 0.0.3

### Patch Changes

- [#4422](https://github.com/bluesky-social/atproto/pull/4422) [`693784c`](https://github.com/bluesky-social/atproto/commit/693784c3a0dee4b6a29aa1e018fce682dcae148f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for base64url encoding/decoding

## 0.0.2

### Patch Changes

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `Cid` interface instead of `CID` class to represent parsed CID data.

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace use of `CID` with `Cid`

- [#4397](https://github.com/bluesky-social/atproto/pull/4397) [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `CHANGELOG.md` to npm package

- Updated dependencies [[`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69)]:
  - @atproto/syntax@0.4.2

## 0.0.1

### Patch Changes

- [#4371](https://github.com/bluesky-social/atproto/pull/4371) [`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Release
