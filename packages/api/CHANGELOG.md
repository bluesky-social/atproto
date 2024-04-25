# @atproto/api

## 0.12.7

### Patch Changes

- [#2390](https://github.com/bluesky-social/atproto/pull/2390) [`58551bbe0`](https://github.com/bluesky-social/atproto/commit/58551bbe0595462c44fc3b6ab5b83e520f141933) Thanks [@foysalit](https://github.com/foysalit)! - Allow muting reports from accounts via `#modEventMuteReporter` event

## 0.12.6

### Patch Changes

- [#2427](https://github.com/bluesky-social/atproto/pull/2427) [`b9b7c5821`](https://github.com/bluesky-social/atproto/commit/b9b7c582199d57d2fe0af8af5c8c411ed34f5b9d) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Introduces V2 of saved feeds preferences. V2 and v1 prefs are incompatible. v1
  methods and preference objects are retained for backwards compatability, but are
  considered deprecated. Developers should immediately migrate to v2 interfaces.

## 0.12.5

### Patch Changes

- [#2419](https://github.com/bluesky-social/atproto/pull/2419) [`3424a1770`](https://github.com/bluesky-social/atproto/commit/3424a17703891f5678ec76ef97e696afb3288b22) Thanks [@pfrazee](https://github.com/pfrazee)! - Add authFactorToken to session objects

## 0.12.4

### Patch Changes

- [#2416](https://github.com/bluesky-social/atproto/pull/2416) [`93a4a4df9`](https://github.com/bluesky-social/atproto/commit/93a4a4df9ce38f89a5d05e300d247b85fb007e05) Thanks [@devinivy](https://github.com/devinivy)! - Support for email auth factor lexicons

## 0.12.3

### Patch Changes

- [#2383](https://github.com/bluesky-social/atproto/pull/2383) [`0edef0ec0`](https://github.com/bluesky-social/atproto/commit/0edef0ec01403fd6097a4d2875b68313f2f1261f) Thanks [@dholms](https://github.com/dholms)! - Added feed generator interaction lexicons

- [#2409](https://github.com/bluesky-social/atproto/pull/2409) [`c6d758b8b`](https://github.com/bluesky-social/atproto/commit/c6d758b8b63f4ef50b2ab9afc62164e92a53e7f0) Thanks [@devinivy](https://github.com/devinivy)! - Support for upcoming post search params

## 0.12.2

### Patch Changes

- [#2344](https://github.com/bluesky-social/atproto/pull/2344) [`abc6f82da`](https://github.com/bluesky-social/atproto/commit/abc6f82da38abef2b1bbe8d9e41a0534a5418c9e) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Support muting words that contain apostrophes and other punctuation

## 0.12.1

### Patch Changes

- [#2342](https://github.com/bluesky-social/atproto/pull/2342) [`eb7668c07`](https://github.com/bluesky-social/atproto/commit/eb7668c07d44f4b42ea2cc28143c64f4ba3312f5) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds the `associated` property to `profile` and `profile-basic` views, bringing them in line with `profile-detailed` views.

## 0.12.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- [#2338](https://github.com/bluesky-social/atproto/pull/2338) [`36f2e966c`](https://github.com/bluesky-social/atproto/commit/36f2e966cba6cc90ba4320520da5c7381cfb8086) Thanks [@pfrazee](https://github.com/pfrazee)! - Fix: correctly detected blocked quote-posts when moderating posts

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/common-web@0.3.0
  - @atproto/lexicon@0.4.0
  - @atproto/syntax@0.3.0
  - @atproto/xrpc@0.5.0

## 0.11.2

### Patch Changes

- [#2328](https://github.com/bluesky-social/atproto/pull/2328) [`7dd9941b7`](https://github.com/bluesky-social/atproto/commit/7dd9941b73dbbd82601740e021cc87d765af60ca) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Remove unecessary escapes from regex, which was causing a minification error when bundled in React Native.

## 0.11.1

### Patch Changes

- [#2312](https://github.com/bluesky-social/atproto/pull/2312) [`219480764`](https://github.com/bluesky-social/atproto/commit/2194807644cbdb0021e867437693300c1b0e55f5) Thanks [@pfrazee](https://github.com/pfrazee)! - Fixed an issue that would cause agent clones to drop the PDS URI config.

## 0.11.0

### Minor Changes

- [#2302](https://github.com/bluesky-social/atproto/pull/2302) [`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0) Thanks [@dholms](https://github.com/dholms)! - - Breaking changes
  - Redesigned the `moderate*` APIs which now output a `ModerationUI` object.
  - `agent.getPreferences()` output object `BskyPreferences` has been modified.
  - Moved Ozone routes from `com.atproto.admin` to `tools.ozone` namespace.
  - Additions
    - Added support for labeler configuration in `Agent.configure()` and `agent.configureLabelerHeader()`.
    - Added `agent.addLabeler()` and `agent.removeLabeler()` preference methods.
    - Muted words and hidden posts are now handled in the `moderate*` APIs.
    - Added `agent.getLabelers()` and `agent.getLabelDefinitions()`.
    - Added `agent.configureProxyHeader()` and `withProxy()` methods to support remote service proxying behaviors.

### Patch Changes

- Updated dependencies [[`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0)]:
  - @atproto/common-web@0.2.4
  - @atproto/lexicon@0.3.3
  - @atproto/syntax@0.2.1
  - @atproto/xrpc@0.4.3

## 0.10.5

### Patch Changes

- [#2279](https://github.com/bluesky-social/atproto/pull/2279) [`192223f12`](https://github.com/bluesky-social/atproto/commit/192223f127c0b226287df1ecfcd953636db08655) Thanks [@gaearon](https://github.com/gaearon)! - Change Following feed prefs to only show replies from people you follow by default

## 0.10.4

### Patch Changes

- [#2260](https://github.com/bluesky-social/atproto/pull/2260) [`6ec885992`](https://github.com/bluesky-social/atproto/commit/6ec8859929a16f9725319cc398b716acf913b01f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Export regex from rich text detection

- [#2260](https://github.com/bluesky-social/atproto/pull/2260) [`6ec885992`](https://github.com/bluesky-social/atproto/commit/6ec8859929a16f9725319cc398b716acf913b01f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Disallow rare unicode whitespace characters from tags

- [#2260](https://github.com/bluesky-social/atproto/pull/2260) [`6ec885992`](https://github.com/bluesky-social/atproto/commit/6ec8859929a16f9725319cc398b716acf913b01f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Allow tags to lead with numbers

## 0.10.3

### Patch Changes

- [#2247](https://github.com/bluesky-social/atproto/pull/2247) [`2a0ceb818`](https://github.com/bluesky-social/atproto/commit/2a0ceb8180faa17de8061d4fa6c361b57a2005ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Fix double sanitization bug when editing muted words.

- [#2247](https://github.com/bluesky-social/atproto/pull/2247) [`2a0ceb818`](https://github.com/bluesky-social/atproto/commit/2a0ceb8180faa17de8061d4fa6c361b57a2005ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - More sanitization of muted words, including newlines and leading/trailing whitespace

- [#2247](https://github.com/bluesky-social/atproto/pull/2247) [`2a0ceb818`](https://github.com/bluesky-social/atproto/commit/2a0ceb8180faa17de8061d4fa6c361b57a2005ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `sanitizeMutedWordValue` util

- [#2247](https://github.com/bluesky-social/atproto/pull/2247) [`2a0ceb818`](https://github.com/bluesky-social/atproto/commit/2a0ceb8180faa17de8061d4fa6c361b57a2005ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Handle hash emoji in mute words

## 0.10.2

### Patch Changes

- [#2245](https://github.com/bluesky-social/atproto/pull/2245) [`61b3d2525`](https://github.com/bluesky-social/atproto/commit/61b3d25253353db2da1336004f94e7dc5adb0410) Thanks [@mary-ext](https://github.com/mary-ext)! - Prevent hashtag emoji from being parsed as a tag

- [#2218](https://github.com/bluesky-social/atproto/pull/2218) [`43531905c`](https://github.com/bluesky-social/atproto/commit/43531905ce1aec6d36d9be5943782811ecca6e6d) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Fix mute word upsert logic by ensuring we're comparing sanitized word values

- [#2245](https://github.com/bluesky-social/atproto/pull/2245) [`61b3d2525`](https://github.com/bluesky-social/atproto/commit/61b3d25253353db2da1336004f94e7dc5adb0410) Thanks [@mary-ext](https://github.com/mary-ext)! - Properly calculate length of tag

- Updated dependencies [[`0c815b964`](https://github.com/bluesky-social/atproto/commit/0c815b964c030aa0f277c40bf9786f130dc320f4)]:
  - @atproto/syntax@0.2.0
  - @atproto/lexicon@0.3.2
  - @atproto/xrpc@0.4.2

## 0.10.1

### Patch Changes

- [#2215](https://github.com/bluesky-social/atproto/pull/2215) [`514aab92d`](https://github.com/bluesky-social/atproto/commit/514aab92d26acd43859285f46318e386846522b1) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add missing `getPreferences` union return types

## 0.10.0

### Minor Changes

- [#2170](https://github.com/bluesky-social/atproto/pull/2170) [`4c511b3d9`](https://github.com/bluesky-social/atproto/commit/4c511b3d9de41ffeae3fc11db941e7df04f4468a) Thanks [@dholms](https://github.com/dholms)! - Add lexicons and methods for account migration

### Patch Changes

- [#2195](https://github.com/bluesky-social/atproto/pull/2195) [`b60719480`](https://github.com/bluesky-social/atproto/commit/b60719480f5f00bffd074a40e8ddc03aa93d137d) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add muted words/tags and hidden posts prefs and methods"

## 0.9.8

### Patch Changes

- [#2192](https://github.com/bluesky-social/atproto/pull/2192) [`f79cc6339`](https://github.com/bluesky-social/atproto/commit/f79cc63390ae9dbd47a4ff5d694eec25b78b788e) Thanks [@foysalit](https://github.com/foysalit)! - Tag event on moderation subjects and allow filtering events and subjects by tags

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
