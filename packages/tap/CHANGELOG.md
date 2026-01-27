# @atproto/tap

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @atproto/lex@0.0.13

## 0.2.0

### Minor Changes

- [#4532](https://github.com/bluesky-social/atproto/pull/4532) [`aaedafc`](https://github.com/bluesky-social/atproto/commit/aaedafc6baef106b85e0954d8474cec21c00c1c2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose `record` data as parsed atproto data (including CIDs and Uint8Arrays)

### Patch Changes

- [#4532](https://github.com/bluesky-social/atproto/pull/4532) [`aaedafc`](https://github.com/bluesky-social/atproto/commit/aaedafc6baef106b85e0954d8474cec21c00c1c2) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace event validation from "zod" to "@atproto/lex"

- [#4562](https://github.com/bluesky-social/atproto/pull/4562) [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add validation error as cause when handling invalid records

- Updated dependencies [[`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b), [`7310b97`](https://github.com/bluesky-social/atproto/commit/7310b9704de678a3b389a741784d58bb7f79b10b)]:
  - @atproto/syntax@0.4.3
  - @atproto/lex@0.0.12
  - @atproto/common@0.5.9

## 0.1.3

### Patch Changes

- [#4534](https://github.com/bluesky-social/atproto/pull/4534) [`0193467`](https://github.com/bluesky-social/atproto/commit/0193467463a1a49c0c7f17d129c07b687a1f5057) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make sure the `destroy()` promise resolves, even in case of error

- [#4534](https://github.com/bluesky-social/atproto/pull/4534) [`0193467`](https://github.com/bluesky-social/atproto/commit/0193467463a1a49c0c7f17d129c07b687a1f5057) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make `TapChannel` implement `AsyncDisposable`, allowing use with `using` keyword

- Updated dependencies []:
  - @atproto/common@0.5.8
  - @atproto/lex@0.0.11

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.5.7
  - @atproto/lex@0.0.10

## 0.1.1

### Patch Changes

- Updated dependencies [[`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98), [`2f78893`](https://github.com/bluesky-social/atproto/commit/2f78893ace3bbf14d4bac36837820ddb46658c98)]:
  - @atproto/lex@0.0.9
  - @atproto/common@0.5.6

## 0.1.0

### Minor Changes

- [#4483](https://github.com/bluesky-social/atproto/pull/4483) [`e3357e9`](https://github.com/bluesky-social/atproto/commit/e3357e9c781ff84430556f4c891639acfcef3486) Thanks [@dholms](https://github.com/dholms)! - Add LexIndexer

## 0.0.3

### Patch Changes

- [#4481](https://github.com/bluesky-social/atproto/pull/4481) [`e15e7cf`](https://github.com/bluesky-social/atproto/commit/e15e7cf1a07d6a4bdd7a9a3c591690613f5414b5) Thanks [@dholms](https://github.com/dholms)! - Fix URL formatting with trailing slash

- Updated dependencies []:
  - @atproto/common@0.5.4

## 0.0.2

### Patch Changes

- [#4290](https://github.com/bluesky-social/atproto/pull/4290) [`b4a76ba`](https://github.com/bluesky-social/atproto/commit/b4a76bae7bef1189302488d43ce49a03fd61f957) Thanks [@dholms](https://github.com/dholms)! - Initial version of package

- Updated dependencies [[`b4a76ba`](https://github.com/bluesky-social/atproto/commit/b4a76bae7bef1189302488d43ce49a03fd61f957)]:
  - @atproto/ws-client@0.0.4
