# @atproto/api

## 0.9.7

### Patch Changes

- [#2188](https://github.com/bluesky-social/atproto/pull/2188) [`8c94979f7`](https://github.com/bluesky-social/atproto/commit/8c94979f73fc5057449e24e66ef2e09b0e17e55b) Thanks [@dholms](https://github.com/dholms)! - Added timelineIndex to savedFeedsPref

## 0.9.6

### Patch Changes

- [#2124](https://github.com/bluesky-social/atproto/pull/2124) [`e4ec7af03`](https://github.com/bluesky-social/atproto/commit/e4ec7af03608949fc3b00a845f547a77599b5ad0) Thanks [@foysalit](https://github.com/foysalit)! - Allow filtering for comment, label, report type and date range on queryModerationEvents endpoint.

## 0.9.5

### Patch Changes

- [#2090](https://github.com/bluesky-social/atproto/pull/2090) [`8994d363`](https://github.com/bluesky-social/atproto/commit/8994d3633adad1c02569d6d44ae896e18195e8e2) Thanks [@dholms](https://github.com/dholms)! - add checkSignupQueue method and expose refreshSession on agent

## 0.9.4

### Patch Changes

- [#2086](https://github.com/bluesky-social/atproto/pull/2086) [`4171c04a`](https://github.com/bluesky-social/atproto/commit/4171c04ad81c5734a4558bc41fa1c4f3a1aba18c) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `setInterestsPref` method to BskyAgent, and `interests` prop to
  `getPreferences` response.

## 0.9.3

### Patch Changes

- [#2081](https://github.com/bluesky-social/atproto/pull/2081) [`5368245a`](https://github.com/bluesky-social/atproto/commit/5368245a6ef7095c86ad166fb04ff9bef27c3c3e) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add unspecced route for new onboarding `app.bsky.unspecced.getTaggedSuggestions`

## 0.9.2

### Patch Changes

- [#2045](https://github.com/bluesky-social/atproto/pull/2045) [`15f38560`](https://github.com/bluesky-social/atproto/commit/15f38560b9e2dc3af8cf860826e7477234fe6a2d) Thanks [@foysalit](https://github.com/foysalit)! - support new lexicons for admin communication templates

## 0.9.1

### Patch Changes

- [#2062](https://github.com/bluesky-social/atproto/pull/2062) [`c6fc73ae`](https://github.com/bluesky-social/atproto/commit/c6fc73aee6c245d12f876abd11889b8dbd0ce2ed) Thanks [@dholms](https://github.com/dholms)! - Directly pass create account params in api agent

## 0.9.0

### Minor Changes

- [#2039](https://github.com/bluesky-social/atproto/pull/2039) [`bf8d718c`](https://github.com/bluesky-social/atproto/commit/bf8d718cf918ac8d8a2cb1f57fde80535284642d) Thanks [@dholms](https://github.com/dholms)! - Namespace lexicon codegen

### Patch Changes

- [#2056](https://github.com/bluesky-social/atproto/pull/2056) [`e43396af`](https://github.com/bluesky-social/atproto/commit/e43396af0973748dd2d034e88d35cf7ae8b4df2c) Thanks [@dholms](https://github.com/dholms)! - Added phone verification methods/schemas to agent.

- [#1988](https://github.com/bluesky-social/atproto/pull/1988) [`51fcba7a`](https://github.com/bluesky-social/atproto/commit/51fcba7a7945c604fc50e9545850a12ef0ee6da6) Thanks [@bnewbold](https://github.com/bnewbold)! - remove deprecated app.bsky.unspecced.getPopular endpoint

## 0.8.0

### Minor Changes

- [#2010](https://github.com/bluesky-social/atproto/pull/2010) [`14067733`](https://github.com/bluesky-social/atproto/commit/140677335f76b99129c1f593d9e11d64624386c6) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Improve `resumeSession` event emission. It will no longer double emit when some
  requests fail, and the `create-failed` event has been replaced by `expired`
  where appropriate, and with a new event `network-error` where appropriate or an
  unknown error occurs.

## 0.7.4

### Patch Changes

- [#1966](https://github.com/bluesky-social/atproto/pull/1966) [`8f3f43cb`](https://github.com/bluesky-social/atproto/commit/8f3f43cb40f79ff7c52f81290daec55cfb000093) Thanks [@pfrazee](https://github.com/pfrazee)! - Fix to the application of the no-unauthenticated label

## 0.7.3

### Patch Changes

- [#1962](https://github.com/bluesky-social/atproto/pull/1962) [`7dec9df3`](https://github.com/bluesky-social/atproto/commit/7dec9df3b583ee8c06c0c6a7e32c259820dc84a5) Thanks [@pfrazee](https://github.com/pfrazee)! - Add seenAt time to listNotifications output

## 0.7.2

### Patch Changes

- [#1776](https://github.com/bluesky-social/atproto/pull/1776) [`ffe39aae`](https://github.com/bluesky-social/atproto/commit/ffe39aae8394394f73bbfaa9047a8b5818aa053a) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `posts_and_author_threads` filter to `getAuthorFeed`

## 0.7.1

### Patch Changes

- [#1944](https://github.com/bluesky-social/atproto/pull/1944) [`60deea17`](https://github.com/bluesky-social/atproto/commit/60deea17622f7c574c18432a55ced4e1cdc1b3a1) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Strip trailing colon from URLs in rich-text facet detection.

## 0.7.0

### Minor Changes

- [#1937](https://github.com/bluesky-social/atproto/pull/1937) [`45352f9b`](https://github.com/bluesky-social/atproto/commit/45352f9b6d02aa405be94e9102424d983912ca5d) Thanks [@pfrazee](https://github.com/pfrazee)! - Add the !no-unauthenticated label to the moderation SDK

## 0.6.24

### Patch Changes

- [#1912](https://github.com/bluesky-social/atproto/pull/1912) [`378fc613`](https://github.com/bluesky-social/atproto/commit/378fc6132f621ca517897c9467ed5bba134b3776) Thanks [@devinivy](https://github.com/devinivy)! - Contains breaking lexicon changes: removing legacy com.atproto admin endpoints, making uri field required on app.bsky list views.

- Updated dependencies [[`3c0ef382`](https://github.com/bluesky-social/atproto/commit/3c0ef382c12a413cc971ae47ffb341236c545f60)]:
  - @atproto/syntax@0.1.5
  - @atproto/lexicon@0.3.1
  - @atproto/xrpc@0.4.1

## 0.6.23

### Patch Changes

- [#1806](https://github.com/bluesky-social/atproto/pull/1806) [`772736a0`](https://github.com/bluesky-social/atproto/commit/772736a01081f39504e1b19a1b3687783bb78f07) Thanks [@devinivy](https://github.com/devinivy)! - respect pds endpoint during session resumption

## 0.6.22

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89), [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/lexicon@0.3.0
  - @atproto/xrpc@0.4.0
  - @atproto/common-web@0.2.3
  - @atproto/syntax@0.1.4

## 0.6.21

### Patch Changes

- [#1779](https://github.com/bluesky-social/atproto/pull/1779) [`9c98a5ba`](https://github.com/bluesky-social/atproto/commit/9c98a5baaf503b02238a6afe4f6e2b79c5181693) Thanks [@pfrazee](https://github.com/pfrazee)! - modlist helpers added to bsky-agent, add blockingByList to viewer state lexicon

- [`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7) Thanks [@devinivy](https://github.com/devinivy)! - Allow pds to serve did doc with credentials, API client to respect PDS listed in the did doc.

- Updated dependencies [[`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7)]:
  - @atproto/common-web@0.2.2
  - @atproto/lexicon@0.2.3
  - @atproto/syntax@0.1.3
  - @atproto/xrpc@0.3.3

## 0.6.20

### Patch Changes

- [#1568](https://github.com/bluesky-social/atproto/pull/1568) [`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b) Thanks [@dholms](https://github.com/dholms)! - Added email verification and update flows

- Updated dependencies [[`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b)]:
  - @atproto/common-web@0.2.1
  - @atproto/lexicon@0.2.2
  - @atproto/syntax@0.1.2
  - @atproto/xrpc@0.3.2

## 0.6.19

### Patch Changes

- [#1674](https://github.com/bluesky-social/atproto/pull/1674) [`35b616cd`](https://github.com/bluesky-social/atproto/commit/35b616cd82232879937afc88d3f77d20c6395276) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Strip leading `#` from from detected tag facets

## 0.6.18

### Patch Changes

- [#1651](https://github.com/bluesky-social/atproto/pull/1651) [`2ce8a11b`](https://github.com/bluesky-social/atproto/commit/2ce8a11b8daf5d39027488c5dde8c47b0eb937bf) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds support for hashtags in the `RichText.detectFacets` method.

## 0.6.17

### Patch Changes

- [#1637](https://github.com/bluesky-social/atproto/pull/1637) [`d96f7d9b`](https://github.com/bluesky-social/atproto/commit/d96f7d9b84c6fbab9711059c8584a77d892dcedd) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Introduce general support for tags on posts

## 0.6.16

### Patch Changes

- [#1653](https://github.com/bluesky-social/atproto/pull/1653) [`56e2cf89`](https://github.com/bluesky-social/atproto/commit/56e2cf8999f6d7522529a9be8652c47545f82242) Thanks [@pfrazee](https://github.com/pfrazee)! - Improve the types of the thread and feed preferences APIs

## 0.6.15

### Patch Changes

- [#1639](https://github.com/bluesky-social/atproto/pull/1639) [`2cc329f2`](https://github.com/bluesky-social/atproto/commit/2cc329f26547217dd94b6bb11ee590d707cbd14f) Thanks [@pfrazee](https://github.com/pfrazee)! - Added new preferences for feed and thread view behaviors.

## 0.6.14

### Patch Changes

- Updated dependencies [[`b1dc3555`](https://github.com/bluesky-social/atproto/commit/b1dc355504f9f2e047093dc56682b8034518cf80)]:
  - @atproto/syntax@0.1.1
  - @atproto/lexicon@0.2.1
  - @atproto/xrpc@0.3.1

## 0.6.13

### Patch Changes

- [#1553](https://github.com/bluesky-social/atproto/pull/1553) [`3877210e`](https://github.com/bluesky-social/atproto/commit/3877210e7fb3c76dfb1a11eb9ba3f18426301d9f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds a new method `app.bsky.graph.getSuggestedFollowsByActor`. This method
  returns suggested follows for a given actor based on their likes and follows.
