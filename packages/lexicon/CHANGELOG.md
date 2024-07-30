# @atproto/lexicon

## 0.4.1-rc.0

### Patch Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`2ded0156b`](https://github.com/bluesky-social/atproto/commit/2ded0156b9adf33b9cce66583a375bff922d383b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add the ability to instantiate a Lexicon from an iterable, and to use a Lexicon as iterable.

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`2ded0156b`](https://github.com/bluesky-social/atproto/commit/2ded0156b9adf33b9cce66583a375bff922d383b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - **New Features**:

  1. Improved Separation of Concerns: We've restructured the XRPC HTTP call
     dispatcher into a distinct class. This means cleaner code organization and
     better clarity on responsibilities.
  2. Enhanced Evolutivity: With this refactor, the XRPC client is now more
     adaptable to various use cases. You can easily extend and customize the
     dispatcher perform session management, retries, and more.

  **Compatibility**:

  Most of the changes introduced in this version are backward-compatible. However,
  there are a couple of breaking changes you should be aware of:

  - Customizing `fetchHandler`: The ability to customize the fetchHandler on the
    XRPC Client and AtpAgent classes has been modified. Please review your code if
    you rely on custom fetch handlers.
  - Managing Sessions: Previously, you had the ability to manage sessions directly
    through AtpAgent instances. Now, session management must be handled through a
    dedicated `SessionManager` instance. If you were making authenticated
    requests, you'll need to update your code to use explicit session management.
  - The `fetch()` method, as well as WhatWG compliant `Request` and `Headers`
    constructors, must be globally available in your environment.

## 0.4.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/common-web@0.3.0
  - @atproto/syntax@0.3.0

## 0.3.3

### Patch Changes

- Updated dependencies [[`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0)]:
  - @atproto/common-web@0.2.4
  - @atproto/syntax@0.2.1

## 0.3.2

### Patch Changes

- Updated dependencies [[`0c815b964`](https://github.com/bluesky-social/atproto/commit/0c815b964c030aa0f277c40bf9786f130dc320f4)]:
  - @atproto/syntax@0.2.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`3c0ef382`](https://github.com/bluesky-social/atproto/commit/3c0ef382c12a413cc971ae47ffb341236c545f60)]:
  - @atproto/syntax@0.1.5

## 0.3.0

### Minor Changes

- [#1801](https://github.com/bluesky-social/atproto/pull/1801) [`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89) Thanks [@gaearon](https://github.com/gaearon)! - Methods that accepts lexicons now take `LexiconDoc` type instead of `unknown`

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/common-web@0.2.3
  - @atproto/syntax@0.1.4

## 0.2.3

### Patch Changes

- Updated dependencies [[`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7)]:
  - @atproto/common-web@0.2.2
  - @atproto/syntax@0.1.3

## 0.2.2

### Patch Changes

- Updated dependencies [[`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b)]:
  - @atproto/common-web@0.2.1
  - @atproto/syntax@0.1.2

## 0.2.1

### Patch Changes

- Updated dependencies [[`b1dc3555`](https://github.com/bluesky-social/atproto/commit/b1dc355504f9f2e047093dc56682b8034518cf80)]:
  - @atproto/syntax@0.1.1
