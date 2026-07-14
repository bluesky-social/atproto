# @atproto/syntax

## 0.7.2

### Patch Changes

- [#5189](https://github.com/bluesky-social/atproto/pull/5189) [`9e1da84`](https://github.com/bluesky-social/atproto/commit/9e1da84cc00a1cc5b453705539a2766403f3ee55) Thanks [@ryanda9910](https://github.com/ryanda9910)! - `parseLanguageString` (strict validation) now rejects language tags whose
  primary language subtag is uppercase (for example `JA`) or is a bare
  four-letter run (for example `jaja`). The primary language subtag must be a
  lowercase two-or-three-letter code per RFC 5646 §2.1.1, matching the atproto
  interop test suite. `isValidLanguage` is unchanged and stays permissive of
  these legacy forms (well-formed syntax only), so existing records are not
  retroactively invalidated. Well-formed lowercase tags are unaffected.

## 0.7.1

### Patch Changes

- [#5197](https://github.com/bluesky-social/atproto/pull/5197) [`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite import statements to be compatible with TypeScript's `verbatimModuleSyntax` config.

## 0.7.0

### Minor Changes

- [#5162](https://github.com/bluesky-social/atproto/pull/5162) [`d1be0ce`](https://github.com/bluesky-social/atproto/commit/d1be0cead444ef95e64cac5ea5318edbec9d8112) Thanks [@nnabeyang](https://github.com/nnabeyang)! - `parseLanguageString` now rejects BCP 47 tags with duplicate variant subtags or duplicate extension singleton subtags, per RFC 5646 §4.1. `isValidLanguage` continues to check only well-formed syntax (§2.1) and is unchanged.

### Patch Changes

- [#5183](https://github.com/bluesky-social/atproto/pull/5183) [`d79f6d5`](https://github.com/bluesky-social/atproto/commit/d79f6d59a073c05cc37bd0d1482beeea482b67ed) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Test language syntax against atproto interop test files

## 0.6.4

### Patch Changes

- [#5169](https://github.com/bluesky-social/atproto/pull/5169) [`28a0b58`](https://github.com/bluesky-social/atproto/commit/28a0b588147863eaef948cd2bb8fc0f19d08cda9) Thanks [@ryanda9910](https://github.com/ryanda9910)! - `isValidLanguage` and `parseLanguageString` now accept BCP 47 tags whose
  private-use subtag uses an uppercase `X` (for example `X-fr-CH` or `de-X-foo`).
  Per RFC 5646 §2.1.1 (and RFC 5234 §2.3, which makes ABNF quoted-string literals
  case-insensitive), private-use subtags are case-insensitive, so these tags are
  well-formed. Previously only the lowercase `x` form was matched. Lowercase tags
  behave exactly as before.

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build using `verbatimModuleSyntax`, reducing runtime import graph

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

## 0.6.3

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

## 0.6.2

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

## 0.6.1

### Patch Changes

- [#4955](https://github.com/bluesky-social/atproto/pull/4955) [`20c5cc1`](https://github.com/bluesky-social/atproto/commit/20c5cc187aab538435c669c6e19a2d2f658af5f8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `isDatetimeStringLenient` datetime validation utility

## 0.6.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

## 0.5.4

### Patch Changes

- [#4806](https://github.com/bluesky-social/atproto/pull/4806) [`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Avoid trailing slashes when stringifying an AtUri

- [#4806](https://github.com/bluesky-social/atproto/pull/4806) [`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Align implementation of `ensureValidAtUri` and `ensureValidAtUriRegex`: consistently apply length and fragment charset restrictions

- [#4806](https://github.com/bluesky-social/atproto/pull/4806) [`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve performances of `AtUriString` validation

- [#4760](https://github.com/bluesky-social/atproto/pull/4760) [`55d06de`](https://github.com/bluesky-social/atproto/commit/55d06de80a1506908a04ed5c0834986cb5783797) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fixes a bug where `normalizeDatetime` would return different results for the same input depending on the timezone of the machine it was run on. This caused tests to fail when run in different environments. The fix consists of attempting more consistent parsing strategies first (appending "Z" or " UTC" to the input) before falling back to parsing "as is", which can yield different results depending on the local timezone. The function's documentation has also been updated to reflect this behavior.

- [#4806](https://github.com/bluesky-social/atproto/pull/4806) [`26d793a`](https://github.com/bluesky-social/atproto/commit/26d793af95a6fb3a50f9b2a97187d8ac4fecf676) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add missing fragment to `AtUriString` template literal type

## 0.5.3

### Patch Changes

- [#4815](https://github.com/bluesky-social/atproto/pull/4815) [`3711454`](https://github.com/bluesky-social/atproto/commit/371145432178b6c8c411f1289c266314cc7ec592) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite of tests

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
