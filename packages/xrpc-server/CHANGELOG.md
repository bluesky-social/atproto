# @atproto/xrpc-server

## 0.6.4

### Patch Changes

- [#2464](https://github.com/bluesky-social/atproto/pull/2464) [`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Properly decode request body encoding

- Updated dependencies [[`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93), [`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93)]:
  - @atproto/common@0.4.2
  - @atproto/xrpc@0.6.2
  - @atproto/crypto@0.4.1

## 0.6.3

### Patch Changes

- [#2743](https://github.com/bluesky-social/atproto/pull/2743) [`ebb318325`](https://github.com/bluesky-social/atproto/commit/ebb318325b6e80c4ea1a93a617569da2698afe31) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `iat` claim to service JWTs

- [#2743](https://github.com/bluesky-social/atproto/pull/2743) [`ebb318325`](https://github.com/bluesky-social/atproto/commit/ebb318325b6e80c4ea1a93a617569da2698afe31) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Ensure that service auth JWT headers contain an `alg` claim, and ensure that `typ`, if present, is not an unexpected type (e.g. not an access or DPoP token).

- Updated dependencies [[`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c), [`ebb318325`](https://github.com/bluesky-social/atproto/commit/ebb318325b6e80c4ea1a93a617569da2698afe31), [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c), [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c)]:
  - @atproto/xrpc@0.6.1
  - @atproto/crypto@0.4.1

## 0.6.2

### Patch Changes

- [#2711](https://github.com/bluesky-social/atproto/pull/2711) [`acbacbbd5`](https://github.com/bluesky-social/atproto/commit/acbacbbd5621473b14ee7a6a3132f675806d23b1) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose the request context for AuthVerifier and StreamAuthVerifier as distinct types

- [#2663](https://github.com/bluesky-social/atproto/pull/2663) [`50c0ec176`](https://github.com/bluesky-social/atproto/commit/50c0ec176c223c90e7c86e1e0c059455fecfa9ae) Thanks [@dholms](https://github.com/dholms)! - Update lxm check error name to BadJwtLexiconMethod

- [#2663](https://github.com/bluesky-social/atproto/pull/2663) [`50c0ec176`](https://github.com/bluesky-social/atproto/commit/50c0ec176c223c90e7c86e1e0c059455fecfa9ae) Thanks [@dholms](https://github.com/dholms)! - Support http.IncomingMessage input to parseReqNsid()

## 0.6.1

### Patch Changes

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`2bdf75d7a`](https://github.com/bluesky-social/atproto/commit/2bdf75d7a63924c10e7a311f16cb447d595b933e), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd)]:
  - @atproto/lexicon@0.4.1
  - @atproto/xrpc@0.6.0

## 0.6.0

### Minor Changes

- [#2668](https://github.com/bluesky-social/atproto/pull/2668) [`dc471da26`](https://github.com/bluesky-social/atproto/commit/dc471da267955d0962a8affaf983df60d962d97c) Thanks [@dholms](https://github.com/dholms)! - Add lxm and nonce to signed service auth tokens.

## 0.5.3

### Patch Changes

- Updated dependencies [[`acc9093d2`](https://github.com/bluesky-social/atproto/commit/acc9093d2845eba02b68fb2f9db33e4f1b59bb10)]:
  - @atproto/common@0.4.1
  - @atproto/crypto@0.4.0

## 0.5.2

### Patch Changes

- [`615a96ddc`](https://github.com/bluesky-social/atproto/commit/615a96ddc2965251cfab060dfc43fc1a51ef4bff) Thanks [@devinivy](https://github.com/devinivy)! - Adjust detection of lexrpc body presence, support 0-byte bodies.

## 0.5.1

### Patch Changes

- [#2384](https://github.com/bluesky-social/atproto/pull/2384) [`cd4fcc709`](https://github.com/bluesky-social/atproto/commit/cd4fcc709fe8d725a4af769ce21f53711fe5622a) Thanks [@dholms](https://github.com/dholms)! - Add configurable catchall

## 0.5.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/lexicon@0.4.0
  - @atproto/common@0.4.0
  - @atproto/crypto@0.4.0

## 0.4.4

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.3.4
  - @atproto/lexicon@0.3.3
  - @atproto/crypto@0.3.0

## 0.4.3

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.3.2

## 0.4.2

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.3.1

## 0.4.1

### Patch Changes

- [#1839](https://github.com/bluesky-social/atproto/pull/1839) [`e1b5f253`](https://github.com/bluesky-social/atproto/commit/e1b5f2537a5ba4d8b951a741269b604856028ae5) Thanks [@dholms](https://github.com/dholms)! - Prevent signature malleability through DER-encoded signatures

- Updated dependencies [[`e1b5f253`](https://github.com/bluesky-social/atproto/commit/e1b5f2537a5ba4d8b951a741269b604856028ae5)]:
  - @atproto/crypto@0.3.0

## 0.4.0

### Minor Changes

- [#1801](https://github.com/bluesky-social/atproto/pull/1801) [`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89) Thanks [@gaearon](https://github.com/gaearon)! - Methods that accepts lexicons now take `LexiconDoc` type instead of `unknown`

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89), [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/lexicon@0.3.0
  - @atproto/common@0.3.3
  - @atproto/crypto@0.2.3

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.3.2
  - @atproto/lexicon@0.2.3

## 0.3.2

### Patch Changes

- Updated dependencies []:
  - @atproto/common@0.3.1
  - @atproto/lexicon@0.2.2

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.2.1
