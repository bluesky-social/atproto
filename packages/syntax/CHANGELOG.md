# @atproto/syntax

## 0.5.2

### Patch Changes

- [#4792](https://github.com/bluesky-social/atproto/pull/4792) [`0dbea15`](https://github.com/bluesky-social/atproto/commit/0dbea15da48a6ca913cc3a3a2d8c0ffe64d7c69a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Make AT-uri validation faster

- [#4408](https://github.com/bluesky-social/atproto/pull/4408) [`d0c136c`](https://github.com/bluesky-social/atproto/commit/d0c136cba2ec8fa97017849b1023d5af5d2cc60c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `isHandleIdentifier` and `isDidIdentifier` utilities to discriminate `AtIdentifierString` variants

- [#4779](https://github.com/bluesky-social/atproto/pull/4779) [`527f5d4`](https://github.com/bluesky-social/atproto/commit/527f5d4c5d0c9264c2ff6f23ad06a41163fc6809) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove year 10 limit on `DatetimeString` and `AtprotoDate`

## 0.5.1

### Patch Changes

- [`67eb0c1`](https://github.com/bluesky-social/atproto/commit/67eb0c19ac415e762e221b2ccda9f0bcf7b3dd6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve efficiency of `AtUri` `did` getter and typing of `hostname` property

## 0.5.0

### Minor Changes

- [#4689](https://github.com/bluesky-social/atproto/pull/4689) [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove global `Date.toISOString()` overload and replace with more accurate, less permissive, `AtprotoDate` interface. This change prevent using any `Date` instance to generate a `DatetimeString`, since some JS dates can actually not be safely stringified to a `DatetimeString`.

### Patch Changes

- [#4689](https://github.com/bluesky-social/atproto/pull/4689) [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add type safe accessors to read and write `AtUri`'s `did`, `collection` and `rkey` properties

- [#4689](https://github.com/bluesky-social/atproto/pull/4689) [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Test `ensureValidDatetime`, `isValidDatetime` and `normalizeDatetime` individually, for expected failures.

- [#4689](https://github.com/bluesky-social/atproto/pull/4689) [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow calling `DatetimeString` validation utilities with `unknown` values (instead of only `string`)

- [#4689](https://github.com/bluesky-social/atproto/pull/4689) [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Preserve input type when normalizing a valid `HandleString`

- [#4688](https://github.com/bluesky-social/atproto/pull/4688) [`52834ab`](https://github.com/bluesky-social/atproto/commit/52834aba182da8df3611fd9dff924e6c6a3973a7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Minor optimization in regex based NSID string validation

- [#4689](https://github.com/bluesky-social/atproto/pull/4689) [`f7c2610`](https://github.com/bluesky-social/atproto/commit/f7c26103a6d4e24e5bedbb6fd908be140420e0dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve type strictness of `NSID`'s `authority` and `toString()` properties

## 0.4.3

### Patch Changes

- [#4571](https://github.com/bluesky-social/atproto/pull/4571) [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add new `isValidAtUri` utility

- [#4571](https://github.com/bluesky-social/atproto/pull/4571) [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `isValidUri` utility

- [#4571](https://github.com/bluesky-social/atproto/pull/4571) [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve typing of type assertion utilities

- [#4571](https://github.com/bluesky-social/atproto/pull/4571) [`99963d0`](https://github.com/bluesky-social/atproto/commit/99963d002a9e030e79aed5fba700e0a68f31e101) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add BCP47 language validation and parsing utilities

## 0.4.2

### Patch Changes

- [#4389](https://github.com/bluesky-social/atproto/pull/4389) [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve typing of various string formats

## 0.4.1

### Patch Changes

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `NSID.from(stringifiable)` utility

- [#4108](https://github.com/bluesky-social/atproto/pull/4108) [`f9dc9aa4c`](https://github.com/bluesky-social/atproto/commit/f9dc9aa4c9eaf2f82d140fbf011a9015e7f1a00d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve performance of NSID validation

## 0.4.0

### Minor Changes

- [#3635](https://github.com/bluesky-social/atproto/pull/3635) [`670b6b5de`](https://github.com/bluesky-social/atproto/commit/670b6b5de2bf91e6944761c98eb1126fb6a681ee) Thanks [@bnewbold](https://github.com/bnewbold)! - update NSID syntax to allow non-leading digits

## 0.3.4

### Patch Changes

- [#2945](https://github.com/bluesky-social/atproto/pull/2945) [`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Deprecate unused classes

## 0.3.3

### Patch Changes

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve performance of isValidTid

## 0.3.2

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

## 0.3.1

### Patch Changes

- [#2911](https://github.com/bluesky-social/atproto/pull/2911) [`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve performances of did validation

## 0.3.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

## 0.2.1

### Patch Changes

- Updated dependencies [[`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0)]:
  - @atproto/common-web@0.2.4

## 0.2.0

### Minor Changes

- [#2223](https://github.com/bluesky-social/atproto/pull/2223) [`0c815b964`](https://github.com/bluesky-social/atproto/commit/0c815b964c030aa0f277c40bf9786f130dc320f4) Thanks [@bnewbold](https://github.com/bnewbold)! - allow colon character in record-key syntax

## 0.1.5

### Patch Changes

- [#1908](https://github.com/bluesky-social/atproto/pull/1908) [`3c0ef382`](https://github.com/bluesky-social/atproto/commit/3c0ef382c12a413cc971ae47ffb341236c545f60) Thanks [@gaearon](https://github.com/gaearon)! - prevent unnecessary throw/catch on uri syntax

## 0.1.4

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/common-web@0.2.3

## 0.1.3

### Patch Changes

- Updated dependencies [[`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7)]:
  - @atproto/common-web@0.2.2

## 0.1.2

### Patch Changes

- Updated dependencies [[`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b)]:
  - @atproto/common-web@0.2.1

## 0.1.1

### Patch Changes

- [#1611](https://github.com/bluesky-social/atproto/pull/1611) [`b1dc3555`](https://github.com/bluesky-social/atproto/commit/b1dc355504f9f2e047093dc56682b8034518cf80) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Fix imports in `README.md`.
