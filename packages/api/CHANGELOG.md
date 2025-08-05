# @atproto/api

## 0.16.2

### Patch Changes

- [#4081](https://github.com/bluesky-social/atproto/pull/4081) [`c370d933b`](https://github.com/bluesky-social/atproto/commit/c370d933b76b4e15b83a82b40d1b6a32bd54add6) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Adds `purpose` filtering to `app.bsky.graph.getLists`.
  Adds `app.bsky.graph.getListsWithMembership`.
  Adds `app.bsky.graph.getStarterPacksWithMembership`.

## 0.16.1

### Patch Changes

- [#3927](https://github.com/bluesky-social/atproto/pull/3927) [`171efadb4`](https://github.com/bluesky-social/atproto/commit/171efadb49f842aa8ff3bf9d790caa6e0e0456ef) Thanks [@foysalit](https://github.com/foysalit)! - Introduces ozone event timeline lexicons

## 0.16.0

### Minor Changes

- [#4072](https://github.com/bluesky-social/atproto/pull/4072) [`9751eebd7`](https://github.com/bluesky-social/atproto/commit/9751eebd718066984a91046b63e410caecd64022) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Remove app.bsky.unspecced.checkHandleAvailability, add com.atproto.temp.checkHandleAvailability

## 0.15.27

### Patch Changes

- [#4058](https://github.com/bluesky-social/atproto/pull/4058) [`8787fd9de`](https://github.com/bluesky-social/atproto/commit/8787fd9dea769716412c9883e355cd496664bc6e) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Only allow initiating age assurance flow from certain states, return `InvalidInitiation` error if violated.

- [#4049](https://github.com/bluesky-social/atproto/pull/4049) [`dc84906c8`](https://github.com/bluesky-social/atproto/commit/dc84906c865e8a97939a909dd3f75decde538363) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - app.bsky.unspecced.checkHandleAvailability lexicon

## 0.15.26

### Patch Changes

- [#4041](https://github.com/bluesky-social/atproto/pull/4041) [`083566ddf`](https://github.com/bluesky-social/atproto/commit/083566ddfc3c9263423ebd5e59bfdbfe7b091c82) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add `unregisterPush` API

- [#4048](https://github.com/bluesky-social/atproto/pull/4048) [`3b356c509`](https://github.com/bluesky-social/atproto/commit/3b356c5096a269f1be6c4e69bdee7f5d14eb5d7e) Thanks [@foysalit](https://github.com/foysalit)! - Add externalId to ozone events for deduping events per subject and event type

## 0.15.25

### Patch Changes

- [#4028](https://github.com/bluesky-social/atproto/pull/4028) [`88c136427`](https://github.com/bluesky-social/atproto/commit/88c136427451a20d21812a1aa88a70cf21904138) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Age assurance compliance

## 0.15.24

### Patch Changes

- [#4034](https://github.com/bluesky-social/atproto/pull/4034) [`34d7a0846`](https://github.com/bluesky-social/atproto/commit/34d7a0846bb14bb36a8cc2747fb7ce73005e59d1) Thanks [@foysalit](https://github.com/foysalit)! - Add age assurance event types to ozone lexicons

- Updated dependencies [[`8ef976d38`](https://github.com/bluesky-social/atproto/commit/8ef976d3852df4bfa376e515e131cc0810a42f20)]:
  - @atproto/lexicon@0.4.12
  - @atproto/xrpc@0.7.1

## 0.15.23

### Patch Changes

- [#3991](https://github.com/bluesky-social/atproto/pull/3991) [`0c0381a2b`](https://github.com/bluesky-social/atproto/commit/0c0381a2bb9b9dc14ca6c1c8c4a6b966f0d516e8) Thanks [@foysalit](https://github.com/foysalit)! - Add modTool parameter to ozone events

## 0.15.22

### Patch Changes

- [#3945](https://github.com/bluesky-social/atproto/pull/3945) [`02c358d0c`](https://github.com/bluesky-social/atproto/commit/02c358d0ca280922c20da5be1e23b4aa9e90a30b) Thanks [@foysalit](https://github.com/foysalit)! - Add safelink module in ozone

## 0.15.21

### Patch Changes

- [#4010](https://github.com/bluesky-social/atproto/pull/4010) [`d344723a1`](https://github.com/bluesky-social/atproto/commit/d344723a1018b2436b5453526397936bd587a2e2) Thanks [@mozzius](https://github.com/mozzius)! - Loosen constraints for saved feed preferences

## 0.15.20

### Patch Changes

- [#4005](https://github.com/bluesky-social/atproto/pull/4005) [`bb65f7a6e`](https://github.com/bluesky-social/atproto/commit/bb65f7a6e22ceedb57c74a18cf0539c1dd04c0a7) Thanks [@mozzius](https://github.com/mozzius)! - add `subscribed-post` notification reason

## 0.15.19

### Patch Changes

- [#3997](https://github.com/bluesky-social/atproto/pull/3997) [`376778a92`](https://github.com/bluesky-social/atproto/commit/376778a92f08fb6709c4cde736bfaca7393a72e1) Thanks [@mozzius](https://github.com/mozzius)! - Add put method for AppBskyNotificationDeclarationRecord

## 0.15.18

### Patch Changes

- [#3995](https://github.com/bluesky-social/atproto/pull/3995) [`e3e31b2b9`](https://github.com/bluesky-social/atproto/commit/e3e31b2b9bf8c4de6b2d7fa992c3b3795686ea72) Thanks [@mozzius](https://github.com/mozzius)! - Add put method to record utility classes

## 0.15.17

### Patch Changes

- [#3990](https://github.com/bluesky-social/atproto/pull/3990) [`6cd120206`](https://github.com/bluesky-social/atproto/commit/6cd12020657bfb5f87e97cd16e4abb379b64f60b) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add activity subscription lexicons

## 0.15.16

### Patch Changes

- [#3966](https://github.com/bluesky-social/atproto/pull/3966) [`97ef11657`](https://github.com/bluesky-social/atproto/commit/97ef116571909c95713017bcd7b621c8afbc90ef) Thanks [@mozzius](https://github.com/mozzius)! - Rename notification preference lexicon "filter" key to "include"

## 0.15.15

### Patch Changes

- [#2934](https://github.com/bluesky-social/atproto/pull/2934) [`7f1316748`](https://github.com/bluesky-social/atproto/commit/7f1316748dedb512ae739ad51b95644baa39fe80) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Fix bug where fuzzy matching mute words was over-zealous e.g. `Andor` matching `and/or`.

- [#2934](https://github.com/bluesky-social/atproto/pull/2934) [`7f1316748`](https://github.com/bluesky-social/atproto/commit/7f1316748dedb512ae739ad51b95644baa39fe80) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Updates mute word matching to include a `matches: MuteWordMatch[]` property on the `muted-word` `cause` type returned as part of a `ModerationDecision`.

## 0.15.14

### Patch Changes

- [#3901](https://github.com/bluesky-social/atproto/pull/3901) [`a48671e73`](https://github.com/bluesky-social/atproto/commit/a48671e730681f692a88053e8f137bd9e2aed5f1) Thanks [@mozzius](https://github.com/mozzius)! - Add notification preferences V2 lexicons

## 0.15.13

### Patch Changes

- [#3929](https://github.com/bluesky-social/atproto/pull/3929) [`c6eb8a12e`](https://github.com/bluesky-social/atproto/commit/c6eb8a12e291c88fea79da447f9da8608d02300d) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Rename `getPostThreadHiddenV2` to `getPostThreadOtherV2` to better reflect the intent of the API.

## 0.15.12

### Patch Changes

- [#3912](https://github.com/bluesky-social/atproto/pull/3912) [`a5cd018bd`](https://github.com/bluesky-social/atproto/commit/a5cd018bd5f237221902ab1b6956b46233c92187) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Unify `getPostThreadV2` and `getPostThreadHiddenV2` responses under `app.bsky.unspecced.defs` namespace and a single interface via `threadItemPost`.

## 0.15.11

### Patch Changes

- [#3910](https://github.com/bluesky-social/atproto/pull/3910) [`a978681fd`](https://github.com/bluesky-social/atproto/commit/a978681fde1c138a5298bae77e5dc36ce155f955) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Updates to app.bsky.unspecced.getPostThreadHiddenV2 done in f6d5a467e71fb54996754cce7747b1e98a34442b (https://github.com/bluesky-social/atproto/pull/3909)

## 0.15.10

### Patch Changes

- [#3825](https://github.com/bluesky-social/atproto/pull/3825) [`1dae6c59a`](https://github.com/bluesky-social/atproto/commit/1dae6c59abe0e5aa4a7b7d0cc1dfee88f458d4b9) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add app.bsky.unspecced.getPostThreadV2

- [#3825](https://github.com/bluesky-social/atproto/pull/3825) [`1dae6c59a`](https://github.com/bluesky-social/atproto/commit/1dae6c59abe0e5aa4a7b7d0cc1dfee88f458d4b9) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add app.bsky.unspecced.getPostThreadHiddenV2

## 0.15.9

### Patch Changes

- [#3882](https://github.com/bluesky-social/atproto/pull/3882) [`79a75bb1e`](https://github.com/bluesky-social/atproto/commit/79a75bb1ed8fc14cefa246621fe1faeebf3fc159) Thanks [@mozzius](https://github.com/mozzius)! - add a "via" field to reposts and likes allowing a reference a repost, and then give a notification when a repost is liked or reposted.

## 0.15.8

### Patch Changes

- [#3869](https://github.com/bluesky-social/atproto/pull/3869) [`80f402f36`](https://github.com/bluesky-social/atproto/commit/80f402f3663af08fd048300738d04c67aa2b9cb8) Thanks [@haileyok](https://github.com/haileyok)! - add `reqId` to feed interactions

## 0.15.7

### Patch Changes

- [#3860](https://github.com/bluesky-social/atproto/pull/3860) [`86b315388`](https://github.com/bluesky-social/atproto/commit/86b3153884099ceeb0cfdb9d2bfdd447c39fb35a) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add liveNow to app.bsky.unspecced.getConfig

## 0.15.6

### Patch Changes

- [#3824](https://github.com/bluesky-social/atproto/pull/3824) [`3a65b68f7`](https://github.com/bluesky-social/atproto/commit/3a65b68f7dc63c8bfbea0ae615f8ae984272f2e4) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add app.bsky.actor.status lexicon

- Updated dependencies [[`cc485d296`](https://github.com/bluesky-social/atproto/commit/cc485d29638488928b5efec3d4b0627040589812), [`f36ab48d9`](https://github.com/bluesky-social/atproto/commit/f36ab48d910fc4a3afcd22138ba014c814beb93b), [`f36ab48d9`](https://github.com/bluesky-social/atproto/commit/f36ab48d910fc4a3afcd22138ba014c814beb93b), [`f36ab48d9`](https://github.com/bluesky-social/atproto/commit/f36ab48d910fc4a3afcd22138ba014c814beb93b), [`cc485d296`](https://github.com/bluesky-social/atproto/commit/cc485d29638488928b5efec3d4b0627040589812)]:
  - @atproto/common-web@0.4.2
  - @atproto/xrpc@0.7.0
  - @atproto/lexicon@0.4.11

## 0.15.5

### Patch Changes

- [#3765](https://github.com/bluesky-social/atproto/pull/3765) [`45354c84f`](https://github.com/bluesky-social/atproto/commit/45354c84f898d79f58c14b5c0da3661beb7353f9) Thanks [@foysalit](https://github.com/foysalit)! - Add verification lexicons to ozone

## 0.15.4

### Patch Changes

- [#3768](https://github.com/bluesky-social/atproto/pull/3768) [`7af77f3ed`](https://github.com/bluesky-social/atproto/commit/7af77f3edfe52f77729f61de4188e8375f03b4ef) Thanks [@devinivy](https://github.com/devinivy)! - Support tools.ozone.hosting.getAccountHistory

## 0.15.3

### Patch Changes

- [#3773](https://github.com/bluesky-social/atproto/pull/3773) [`0087dc1c0`](https://github.com/bluesky-social/atproto/commit/0087dc1c0bafad1d0a0a1a16683d250dea031bf9) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add verification notifications

## 0.15.2

### Patch Changes

- [#3770](https://github.com/bluesky-social/atproto/pull/3770) [`553c988f1`](https://github.com/bluesky-social/atproto/commit/553c988f1d226b3d2fbe94c117b088f5c82db794) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `verificationPrefs` and `hideBadges` setting to user prefs.

## 0.15.1

### Patch Changes

- [#3761](https://github.com/bluesky-social/atproto/pull/3761) [`688268b6a`](https://github.com/bluesky-social/atproto/commit/688268b6a5ee30f0922ee152ffbd26583d164ae4) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add verification state to profile view lexicons

- [#3766](https://github.com/bluesky-social/atproto/pull/3766) [`8d99915ce`](https://github.com/bluesky-social/atproto/commit/8d99915ce02c73b9b37bf121ccd2703fa14a906a) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Update chat verification lexicon

## 0.15.0

### Minor Changes

- [#3715](https://github.com/bluesky-social/atproto/pull/3715) [`23462184d`](https://github.com/bluesky-social/atproto/commit/23462184dc941ba2fc3b4d054985a53715585020) Thanks [@knotbin](https://github.com/knotbin)! - run codegen for changes in lex-cli

## 0.14.22

### Patch Changes

- [#3714](https://github.com/bluesky-social/atproto/pull/3714) [`fc61662d7`](https://github.com/bluesky-social/atproto/commit/fc61662d7b88597f78383e37ee54264a8bb4b670) Thanks [@bnewbold](https://github.com/bnewbold)! - new lexicons: listHosts and getHostStatus endpoints under com.atproto.sync

- [#3741](https://github.com/bluesky-social/atproto/pull/3741) [`ca07871c4`](https://github.com/bluesky-social/atproto/commit/ca07871c487abc99fe7b7f8671aa8d98eb5dc4bb) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Update reaction limit on chat lexicon

## 0.14.21

### Patch Changes

- [#3724](https://github.com/bluesky-social/atproto/pull/3724) [`8b7bf7e8f`](https://github.com/bluesky-social/atproto/commit/8b7bf7e8f0e5447c68633a87a2a3cff99f9e7e1c) Thanks [@haileyok](https://github.com/haileyok)! - Return `ProfileView` from `getSuggestedUsers` unspecced endpoint

## 0.14.20

### Patch Changes

- [#3713](https://github.com/bluesky-social/atproto/pull/3713) [`0e681d303`](https://github.com/bluesky-social/atproto/commit/0e681d3036fd0b35c6d2198638392051b2ce4c81) Thanks [@haileyok](https://github.com/haileyok)! - add `getSuggestedUsers` and `getSuggestedUsersSkeleton`

## 0.14.19

### Patch Changes

- [#3680](https://github.com/bluesky-social/atproto/pull/3680) [`efb302db1`](https://github.com/bluesky-social/atproto/commit/efb302db1a615b68795c725a22489dbd0400e011) Thanks [@haileyok](https://github.com/haileyok)! - Add unspecced `getSuggestedFeeds` and associated types

- Updated dependencies [[`4db923ca1`](https://github.com/bluesky-social/atproto/commit/4db923ca1c4fadd31d41c851933659e5186ee144)]:
  - @atproto/common-web@0.4.1
  - @atproto/lexicon@0.4.10
  - @atproto/xrpc@0.6.12

## 0.14.18

### Patch Changes

- [#3706](https://github.com/bluesky-social/atproto/pull/3706) [`04b6230cd`](https://github.com/bluesky-social/atproto/commit/04b6230cd2fbfe4a06cb00ab8ccb8e6c87c6c546) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Return `StarterPackView` instead of `StarterPackViewBasic` from `getSuggestedStarterPacks`

## 0.14.17

### Patch Changes

- [#2519](https://github.com/bluesky-social/atproto/pull/2519) [`bdbd3c3e3`](https://github.com/bluesky-social/atproto/commit/bdbd3c3e3f8fe8476a3fecac73810554846c938f) Thanks [@dholms](https://github.com/dholms)! - Add com.atproto.admin.updateAccountSigningKey

- [#3673](https://github.com/bluesky-social/atproto/pull/3673) [`2b7efb6cb`](https://github.com/bluesky-social/atproto/commit/2b7efb6cb1c93a108570efdafe9d9ec3f1018dfa) Thanks [@haileyok](https://github.com/haileyok)! - Add `getTrends`, `getTrendsSkeleton`, and associated types

- [#3705](https://github.com/bluesky-social/atproto/pull/3705) [`b0a0f1484`](https://github.com/bluesky-social/atproto/commit/b0a0f1484378adeb5e2aa20b9b6ff2c2eca0f740) Thanks [@dholms](https://github.com/dholms)! - Fix codegent for com.atproto.admin.updateAccountSigningKey

- [#3677](https://github.com/bluesky-social/atproto/pull/3677) [`0eea698be`](https://github.com/bluesky-social/atproto/commit/0eea698bef76520ae4cc0e1f2efbb588a0459556) Thanks [@haileyok](https://github.com/haileyok)! - Add `getSuggestedStarterPacks`, `getSuggestedStarterPacksSkeleton`, and associated types

## 0.14.16

### Patch Changes

- [#3695](https://github.com/bluesky-social/atproto/pull/3695) [`652894308`](https://github.com/bluesky-social/atproto/commit/65289430806976ec13177ed9c9f0e883e8f9330c) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Fix last reaction lexicon

## 0.14.15

### Patch Changes

- [#3692](https://github.com/bluesky-social/atproto/pull/3692) [`b4ab5011b`](https://github.com/bluesky-social/atproto/commit/b4ab5011bcc64f9f05122a8773806af8e0c13146) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Support more ways to instantiate an `Agent`

## 0.14.14

### Patch Changes

- [#3685](https://github.com/bluesky-social/atproto/pull/3685) [`9a05892f6`](https://github.com/bluesky-social/atproto/commit/9a05892f6fd405bf6bb96c9c8d2a9a89d5e94bc5) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Update chat reaction lexicon

## 0.14.13

### Patch Changes

- [#3651](https://github.com/bluesky-social/atproto/pull/3651) [`076c2f987`](https://github.com/bluesky-social/atproto/commit/076c2f9872387217806624306e3af08878d1adcd) Thanks [@foysalit](https://github.com/foysalit)! - Add getSubjects endpoint to ozone for fetching detailed view of multiple subjects

## 0.14.12

### Patch Changes

- [#3674](https://github.com/bluesky-social/atproto/pull/3674) [`44f5c3639`](https://github.com/bluesky-social/atproto/commit/44f5c3639fcaf73865d21ec4b0c64baa641006c0) Thanks [@mozzius](https://github.com/mozzius)! - run codegen for changes in chat lexicon

## 0.14.11

### Patch Changes

- [#3670](https://github.com/bluesky-social/atproto/pull/3670) [`d87ffc7bf`](https://github.com/bluesky-social/atproto/commit/d87ffc7bfe3c1e792dc84a320544eb2e053d61ce) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add DM reactions lexicons

## 0.14.10

### Patch Changes

- Updated dependencies [[`670b6b5de`](https://github.com/bluesky-social/atproto/commit/670b6b5de2bf91e6944761c98eb1126fb6a681ee)]:
  - @atproto/syntax@0.4.0
  - @atproto/lexicon@0.4.9
  - @atproto/xrpc@0.6.11

## 0.14.9

### Patch Changes

- [#3587](https://github.com/bluesky-social/atproto/pull/3587) [`18fbfa000`](https://github.com/bluesky-social/atproto/commit/18fbfa00057dda9ef4eba77d8b4e87994893c952) Thanks [@foysalit](https://github.com/foysalit)! - Add searchable handle and displayName to ozone team members

## 0.14.8

### Patch Changes

- [#3585](https://github.com/bluesky-social/atproto/pull/3585) [`38320191e`](https://github.com/bluesky-social/atproto/commit/38320191e559f8b928c6e951a9b4a6207240bfc1) Thanks [@dholms](https://github.com/dholms)! - Wrap sync v1.1 semantics. Add #sync event to subscribeRepos and deprecate #handle and #tombstone events

- [#3602](https://github.com/bluesky-social/atproto/pull/3602) [`6bcbb6d8c`](https://github.com/bluesky-social/atproto/commit/6bcbb6d8cd3696280935ff7892d8e191fd21fa49) Thanks [@devinivy](https://github.com/devinivy)! - Permit 100mb video embeds.

- [#2264](https://github.com/bluesky-social/atproto/pull/2264) [`dc6e4ecb0`](https://github.com/bluesky-social/atproto/commit/dc6e4ecb0e09bbf4bc7a79c6ac43fb6da4166200) Thanks [@bnewbold](https://github.com/bnewbold)! - new com.atproto.identity endpoints: resolveDid, resolveIdentity, refreshIdentity

- Updated dependencies [[`850e39843`](https://github.com/bluesky-social/atproto/commit/850e39843cb0ec9ea716675f7568c0c601f45e29)]:
  - @atproto/syntax@0.3.4
  - @atproto/lexicon@0.4.8
  - @atproto/xrpc@0.6.10

## 0.14.7

### Patch Changes

- [#3521](https://github.com/bluesky-social/atproto/pull/3521) [`99e2809ca`](https://github.com/bluesky-social/atproto/commit/99e2809ca2ebf70acaa10254f140a8dd0fad4305) Thanks [@bnewbold](https://github.com/bnewbold)! - Add `reasonTypes`, `subjectTypes`, and `subjectCollections` properties to labeler service records.

- [#2506](https://github.com/bluesky-social/atproto/pull/2506) [`27b0a7be1`](https://github.com/bluesky-social/atproto/commit/27b0a7be1ed1b6e098114791d84ec9dc844db552) Thanks [@bnewbold](https://github.com/bnewbold)! - remove some deprecated fields from com.atproto Lexicons

- [#3579](https://github.com/bluesky-social/atproto/pull/3579) [`11d8d21be`](https://github.com/bluesky-social/atproto/commit/11d8d21beac4b79ac44b930197761f9d08dbb492) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Mirror new labeler service record properties on `labelerViewDetailed`.

## 0.14.6

### Patch Changes

- [#3576](https://github.com/bluesky-social/atproto/pull/3576) [`44f81f2eb`](https://github.com/bluesky-social/atproto/commit/44f81f2eb9229e21aec4472b3a05e855396dbec5) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add chat.bsky.convo.updateAllRead lex

## 0.14.5

### Patch Changes

- [#3449](https://github.com/bluesky-social/atproto/pull/3449) [`7e3678c08`](https://github.com/bluesky-social/atproto/commit/7e3678c089d2faa1a884a52a4fb80b8116c9854f) Thanks [@dholms](https://github.com/dholms)! - Updated subscribeRepo to include prev CIDs for operations and covering proofs for all ops.

- [#3572](https://github.com/bluesky-social/atproto/pull/3572) [`9b643fbec`](https://github.com/bluesky-social/atproto/commit/9b643fbecac30de5cfdb80d0671bfa55e9f4512a) Thanks [@foysalit](https://github.com/foysalit)! - Make comment property optional on ozone comment event

- [#3391](https://github.com/bluesky-social/atproto/pull/3391) [`6e382f67a`](https://github.com/bluesky-social/atproto/commit/6e382f67aa73532efadfea80ff96a27b526cb178) Thanks [@bnewbold](https://github.com/bnewbold)! - update sync lexicons for induction firehose

## 0.14.4

### Patch Changes

- [#3561](https://github.com/bluesky-social/atproto/pull/3561) [`b9cb049d9`](https://github.com/bluesky-social/atproto/commit/b9cb049d940cc706681142ef498238f74e2f539c) Thanks [@foysalit](https://github.com/foysalit)! - Add Divert event to the list of allowed ozone events

## 0.14.3

### Patch Changes

- [#3564](https://github.com/bluesky-social/atproto/pull/3564) [`22af31a89`](https://github.com/bluesky-social/atproto/commit/22af31a898476c5e317aea263af366bddda120d6) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Update chat lexicons

- [#2378](https://github.com/bluesky-social/atproto/pull/2378) [`01874c4be`](https://github.com/bluesky-social/atproto/commit/01874c4be73a41ffb8fe28378f674949aa2c938f) Thanks [@bnewbold](https://github.com/bnewbold)! - set 'tid' and 'record-key' formats on com.atproto.sync and com.atproto.repo lexicons

## 0.14.2

### Patch Changes

- [#3524](https://github.com/bluesky-social/atproto/pull/3524) [`010f10c6f`](https://github.com/bluesky-social/atproto/commit/010f10c6f212f699ad42c0349a58bbcf2172e3cc) Thanks [@bnewbold](https://github.com/bnewbold)! - add com.atproto.sync.listReposByCollection Lexicon

- [#3546](https://github.com/bluesky-social/atproto/pull/3546) [`a9887f687`](https://github.com/bluesky-social/atproto/commit/a9887f68778c49932d92cfea98aadcfa4d5b62e9) Thanks [@foysalit](https://github.com/foysalit)! - Add reporter stats endpoint on ozone service

## 0.14.1

### Patch Changes

- [#3535](https://github.com/bluesky-social/atproto/pull/3535) [`ba5bb6e66`](https://github.com/bluesky-social/atproto/commit/ba5bb6e667fb58bbefd332844957de575e102ca3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix bug preventing "logout()" calls from working.

## 0.14.0

### Minor Changes

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update Lexicon derived code to better reflect data typings. In particular, Lexicon derived interfaces will now explicitly include the `$type` property that can be present in the data.

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Helper functions (e.g. `NS.isRecord`) no longer casts the output value. Use `asPredicate(NS.validateRecord)` to create a predicate function that will ensure that an unknown value is indeed an `NS.Record`. The `isX` helper function's purpose is to discriminate between `$type`d values from unions.

### Patch Changes

- [#2999](https://github.com/bluesky-social/atproto/pull/2999) [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fixes a bug that would clear interests prefs when updating hidden posts

- Updated dependencies [[`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c), [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c), [`c53d943c8`](https://github.com/bluesky-social/atproto/commit/c53d943c8be5b8886254e020970a68c0f745b14c)]:
  - @atproto/syntax@0.3.3
  - @atproto/lexicon@0.4.7
  - @atproto/xrpc@0.6.9

## 0.13.35

### Patch Changes

- [#3495](https://github.com/bluesky-social/atproto/pull/3495) [`709a85b0b`](https://github.com/bluesky-social/atproto/commit/709a85b0b633b5483b7161db64b429c746239153) Thanks [@foysalit](https://github.com/foysalit)! - Add a priority score to ozone subjects

## 0.13.34

### Patch Changes

- [#3496](https://github.com/bluesky-social/atproto/pull/3496) [`dc8a7842e`](https://github.com/bluesky-social/atproto/commit/dc8a7842e67f5f3709e88310d2a60d384453b486) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add followerRule threadgate

- [#3501](https://github.com/bluesky-social/atproto/pull/3501) [`636951e47`](https://github.com/bluesky-social/atproto/commit/636951e4728cd52c2e5355eb93b47d7e869b67e9) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Include `followerRule` as valid setting in `postInteractionSettings` pref

## 0.13.33

### Patch Changes

- [#3220](https://github.com/bluesky-social/atproto/pull/3220) [`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Apply new linting rules regarding import order

- [#3494](https://github.com/bluesky-social/atproto/pull/3494) [`87ed907a6`](https://github.com/bluesky-social/atproto/commit/87ed907a6b96b408c02c9af819cec8380a453254) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `setPostInteractionSettings` for configuring default interaction settings for creation of posts

- Updated dependencies [[`61dc0d60e`](https://github.com/bluesky-social/atproto/commit/61dc0d60e19b88c6427a54c6d95a391b5f4da7bd), [`8a30e0ed9`](https://github.com/bluesky-social/atproto/commit/8a30e0ed9239cb2037d54fb98e70e8b0cfbc3e39)]:
  - @atproto/common-web@0.4.0
  - @atproto/lexicon@0.4.6
  - @atproto/syntax@0.3.2
  - @atproto/xrpc@0.6.8

## 0.13.32

### Patch Changes

- [#3352](https://github.com/bluesky-social/atproto/pull/3352) [`7f52e6735`](https://github.com/bluesky-social/atproto/commit/7f52e67354906c3bf9830d7a2924ab58d6160905) Thanks [@foysalit](https://github.com/foysalit)! - Auto resolve appeals when taking down

- Updated dependencies [[`fb64d50ee`](https://github.com/bluesky-social/atproto/commit/fb64d50ee220316b9f1183e5c3259629489734c9)]:
  - @atproto/xrpc@0.6.7

## 0.13.31

### Patch Changes

- [#3441](https://github.com/bluesky-social/atproto/pull/3441) [`8c6c7813a`](https://github.com/bluesky-social/atproto/commit/8c6c7813a9c2110c8fe21acdca8f09554a1983ce) Thanks [@mozzius](https://github.com/mozzius)! - Allow passing `allowTakendown` to createSession

## 0.13.30

### Patch Changes

- [#3429](https://github.com/bluesky-social/atproto/pull/3429) [`e6e6aea38`](https://github.com/bluesky-social/atproto/commit/e6e6aea3814e3d0bb42a537f80d77947e85fa73f) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - add feedViewPost.threadContext defs

- [#3390](https://github.com/bluesky-social/atproto/pull/3390) [`c0a75d310`](https://github.com/bluesky-social/atproto/commit/c0a75d310aa92c067799a97d1acc5bd0543114c5) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - posts_with_video filter in getAuthorFeed

## 0.13.29

### Patch Changes

- [#3416](https://github.com/bluesky-social/atproto/pull/3416) [`50603b4f2`](https://github.com/bluesky-social/atproto/commit/50603b4f2ef08bd618730107ec164a57f27dcca6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update `tools.ozone.moderation.queryStatuses` lexicon

## 0.13.28

### Patch Changes

- [#3389](https://github.com/bluesky-social/atproto/pull/3389) [`cbf17066f`](https://github.com/bluesky-social/atproto/commit/cbf17066f314fbc7f2e943127ee4a9f589f8bec2) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - add feedgen content mode lexicon spec

## 0.13.27

### Patch Changes

- [#3364](https://github.com/bluesky-social/atproto/pull/3364) [`e277158f7`](https://github.com/bluesky-social/atproto/commit/e277158f70a831b04fde3ec84b3c1eaa6ce82e9d) Thanks [@iwsmith](https://github.com/iwsmith)! - add recId to getSuggestions

## 0.13.26

### Patch Changes

- Updated dependencies [[`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99), [`72eba67af`](https://github.com/bluesky-social/atproto/commit/72eba67af1af8320b5400bcb9319d5c3c8407d99)]:
  - @atproto/common-web@0.3.2
  - @atproto/lexicon@0.4.5
  - @atproto/xrpc@0.6.6

## 0.13.25

### Patch Changes

- [#3271](https://github.com/bluesky-social/atproto/pull/3271) [`53621f8e1`](https://github.com/bluesky-social/atproto/commit/53621f8e100a3aa3c1caff10a08d3f4ea919875a) Thanks [@foysalit](https://github.com/foysalit)! - Allow setting policy names with takedown actions and when querying events

## 0.13.24

### Patch Changes

- [#3294](https://github.com/bluesky-social/atproto/pull/3294) [`d90d999de`](https://github.com/bluesky-social/atproto/commit/d90d999defda01a9b04dbce129e254990062c283) Thanks [@foysalit](https://github.com/foysalit)! - Limit tags filter to 25 max and remove 25 char limit for tag item

## 0.13.23

### Patch Changes

- [#3251](https://github.com/bluesky-social/atproto/pull/3251) [`6d308b857`](https://github.com/bluesky-social/atproto/commit/6d308b857ba2a514ee3c75ebdef7225e298ed7d7) Thanks [@foysalit](https://github.com/foysalit)! - Allow createSession to request takendown account scope

- [#3280](https://github.com/bluesky-social/atproto/pull/3280) [`9ea2cce9a`](https://github.com/bluesky-social/atproto/commit/9ea2cce9a4c0a08994a8cb5abc81dc4bc2221d0c) Thanks [@foysalit](https://github.com/foysalit)! - Apply ozone queue splitting at the database query level

## 0.13.22

### Patch Changes

- [#3270](https://github.com/bluesky-social/atproto/pull/3270) [`f22383cee`](https://github.com/bluesky-social/atproto/commit/f22383cee8feb8b9f761c801ab6e07ad8dc019ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add support for label def aliases, deprecation notices. This provides support for the deprecated `gore` label until a full cleanup effort can be completed.

## 0.13.21

### Patch Changes

- [#3250](https://github.com/bluesky-social/atproto/pull/3250) [`dced566de`](https://github.com/bluesky-social/atproto/commit/dced566de5079ef4208801db476a7e7416f5e5aa) Thanks [@haileyok](https://github.com/haileyok)! - add trending topics

## 0.13.20

### Patch Changes

- [#3222](https://github.com/bluesky-social/atproto/pull/3222) [`207728d2b`](https://github.com/bluesky-social/atproto/commit/207728d2b3b819af297ecb90e6373eb7721cbe34) Thanks [@gaearon](https://github.com/gaearon)! - Add optional reasons param to listNotifications

- Updated dependencies [[`9fd65ba0f`](https://github.com/bluesky-social/atproto/commit/9fd65ba0fa4caca59fd0e6156145e4c2618e3a95)]:
  - @atproto/lexicon@0.4.4
  - @atproto/xrpc@0.6.5

## 0.13.19

### Patch Changes

- [#3171](https://github.com/bluesky-social/atproto/pull/3171) [`ed2236220`](https://github.com/bluesky-social/atproto/commit/ed2236220900ab9a6132c525289cfdd959733a42) Thanks [@foysalit](https://github.com/foysalit)! - Allow moderators to optionally acknowledge all open subjects of an account when acknowledging account level reports

## 0.13.18

### Patch Changes

- [#3082](https://github.com/bluesky-social/atproto/pull/3082) [`a3ce23c4c`](https://github.com/bluesky-social/atproto/commit/a3ce23c4ccf4f40998b9d1f5731e5c905390aedc) Thanks [@gaearon](https://github.com/gaearon)! - Add hotness as a thread sorting option

## 0.13.17

### Patch Changes

- [#2978](https://github.com/bluesky-social/atproto/pull/2978) [`a4b528e5f`](https://github.com/bluesky-social/atproto/commit/a4b528e5f51c8bfca56b293b0059b88d138ec421) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add searchStarterPacks and searchStarterPacksSkeleton

- [#3056](https://github.com/bluesky-social/atproto/pull/3056) [`2e7aa211d`](https://github.com/bluesky-social/atproto/commit/2e7aa211d2cbc629899c7f87f1713b13b932750b) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add com.atproto.temp.addReservedHandle lexicon

## 0.13.16

### Patch Changes

- [#2988](https://github.com/bluesky-social/atproto/pull/2988) [`48d08a469`](https://github.com/bluesky-social/atproto/commit/48d08a469f75837e3b7e879d286d12780440b8b8) Thanks [@foysalit](https://github.com/foysalit)! - Make durationInHours optional for mute reporter event

- [#2911](https://github.com/bluesky-social/atproto/pull/2911) [`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export the generated lexicons `schemas` definitions

- [#2953](https://github.com/bluesky-social/atproto/pull/2953) [`561431fe4`](https://github.com/bluesky-social/atproto/commit/561431fe4897e81767dc768e9a31020d09bf86ff) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add convoView.opened to lexicon definition

- Updated dependencies [[`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d), [`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d)]:
  - @atproto/syntax@0.3.1
  - @atproto/lexicon@0.4.3
  - @atproto/xrpc@0.6.4

## 0.13.15

### Patch Changes

- [#2661](https://github.com/bluesky-social/atproto/pull/2661) [`d6f33b474`](https://github.com/bluesky-social/atproto/commit/d6f33b4742e0b94722a993efc7d18833d9416bb6) Thanks [@foysalit](https://github.com/foysalit)! - Add mod events and status filter for account and record hosting status

- [#2957](https://github.com/bluesky-social/atproto/pull/2957) [`b6eeb81c6`](https://github.com/bluesky-social/atproto/commit/b6eeb81c6d454b5ae91b05a21fc1820274c1b429) Thanks [@gaearon](https://github.com/gaearon)! - Detect facets in parallel

- [#2917](https://github.com/bluesky-social/atproto/pull/2917) [`839202a3d`](https://github.com/bluesky-social/atproto/commit/839202a3d2b01de25de900cec7540019545798c6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow instantiating an API Agent with a string or URL

- [#2933](https://github.com/bluesky-social/atproto/pull/2933) [`e680d55ca`](https://github.com/bluesky-social/atproto/commit/e680d55ca2d7f6b213e2a8693eba6be39163ba41) Thanks [@mozzius](https://github.com/mozzius)! - Fix handling of invalid facets in RichText

- [#2905](https://github.com/bluesky-social/atproto/pull/2905) [`c4b5e5395`](https://github.com/bluesky-social/atproto/commit/c4b5e53957463c37dd16fdd1b897d4ab02ab8e84) Thanks [@foysalit](https://github.com/foysalit)! - Add user specific and instance-wide settings api for ozone

## 0.13.14

### Patch Changes

- [#2918](https://github.com/bluesky-social/atproto/pull/2918) [`209238769`](https://github.com/bluesky-social/atproto/commit/209238769c0bf38bf04f7fa9621eeb176b5c0ed8) Thanks [@devinivy](https://github.com/devinivy)! - add app.bsky.unspecced.getConfig endpoint

- [#2931](https://github.com/bluesky-social/atproto/pull/2931) [`73f40e63a`](https://github.com/bluesky-social/atproto/commit/73f40e63abe3283efc0a27eef781c00b497caad1) Thanks [@dholms](https://github.com/dholms)! - Add threatSignatures to ozone repo views

## 0.13.13

### Patch Changes

- [#2914](https://github.com/bluesky-social/atproto/pull/2914) [`19e36afb2`](https://github.com/bluesky-social/atproto/commit/19e36afb2c13dbc7b1033eb3cab5e7fc6f496fdc) Thanks [@foysalit](https://github.com/foysalit)! - Add collections and subjectType filters to ozone's queryEvents and queryStatuses endpoints

## 0.13.12

### Patch Changes

- [#2636](https://github.com/bluesky-social/atproto/pull/2636) [`22d039a22`](https://github.com/bluesky-social/atproto/commit/22d039a229e3ef08a793e1c98b473b1b8e18ac5e) Thanks [@foysalit](https://github.com/foysalit)! - Sets api to manage lists of strings on ozone, mostly aimed for automod configuration

## 0.13.11

### Patch Changes

- [#2857](https://github.com/bluesky-social/atproto/pull/2857) [`a0531ce42`](https://github.com/bluesky-social/atproto/commit/a0531ce429f5139cb0e2cc19aa9b338599947e44) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds support for muting words within link cards attached to `RecordWithMedia` embeds.

## 0.13.10

### Patch Changes

- [#2855](https://github.com/bluesky-social/atproto/pull/2855) [`df14df522`](https://github.com/bluesky-social/atproto/commit/df14df522bb7986e56ee1f6a0f5d862e1ea6f4d5) Thanks [@dholms](https://github.com/dholms)! - Add tools.ozone.signature lexicons

## 0.13.9

### Patch Changes

- [#2836](https://github.com/bluesky-social/atproto/pull/2836) [`a2bad977a`](https://github.com/bluesky-social/atproto/commit/a2bad977a8d941b4075ea3ffee3d6f7a0c0f467c) Thanks [@foysalit](https://github.com/foysalit)! - Add getRepos and getRecords endpoints for bulk fetching

## 0.13.8

### Patch Changes

- [#2771](https://github.com/bluesky-social/atproto/pull/2771) [`2676206e4`](https://github.com/bluesky-social/atproto/commit/2676206e422233fefbf2d9d182e8d462f0957c93) Thanks [@mozzius](https://github.com/mozzius)! - Add pinned posts to profile record and getAuthorFeed

- Updated dependencies [[`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`eb20ff64a`](https://github.com/bluesky-social/atproto/commit/eb20ff64a2d8e3061c652e1e247bf9b0fe3c41a6), [`87a1f2426`](https://github.com/bluesky-social/atproto/commit/87a1f24262e0e644b6cf31cc7a0446d9127ffa94)]:
  - @atproto/xrpc@0.6.3
  - @atproto/common-web@0.3.1
  - @atproto/lexicon@0.4.2

## 0.13.7

### Patch Changes

- [#2807](https://github.com/bluesky-social/atproto/pull/2807) [`e6bd5aecc`](https://github.com/bluesky-social/atproto/commit/e6bd5aecce7954d60e5fb263297e697ab7aab98e) Thanks [@foysalit](https://github.com/foysalit)! - Introduce a acknowledgeAccountSubjects flag on takedown event to ack all subjects from the author that need review

- [#2810](https://github.com/bluesky-social/atproto/pull/2810) [`33aa0c722`](https://github.com/bluesky-social/atproto/commit/33aa0c722226a18215af0ae1833c7c552fc7aaa7) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add NUX API

- Updated dependencies [[`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93)]:
  - @atproto/xrpc@0.6.2

## 0.13.6

### Patch Changes

- [#2780](https://github.com/bluesky-social/atproto/pull/2780) [`e4d41d66f`](https://github.com/bluesky-social/atproto/commit/e4d41d66fa4757a696363f39903562458967b63d) Thanks [@foysalit](https://github.com/foysalit)! - Add language property to communication templates

## 0.13.5

### Patch Changes

- [#2751](https://github.com/bluesky-social/atproto/pull/2751) [`80ada8f47`](https://github.com/bluesky-social/atproto/commit/80ada8f47628f55f3074cd16a52857e98d117e14) Thanks [@devinivy](https://github.com/devinivy)! - Lexicons and support for video embeds within bsky posts.

## 0.13.4

### Patch Changes

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Drop use of `AtpBaseClient` class

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose the `CredentialSession` class that can be used to instantiate both `Agent` and `XrpcClient`, while internally managing credential based (username/password) sessions.

- [`bbca17bc5`](https://github.com/bluesky-social/atproto/commit/bbca17bc5388e0b2af26fb107347c8ab507ee42f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Deprecate Agent.accountDid in favor of Agent.assertDid

- [#2737](https://github.com/bluesky-social/atproto/pull/2737) [`a8e1f9000`](https://github.com/bluesky-social/atproto/commit/a8e1f9000d9617c4df9d9f0e74ae0e0b73fcfd66) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `threadgate: ThreadgateView` to response from `getPostThread`

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - `Agent` is no longer an abstract class. Instead it can be instantiated using object implementing a new `SessionManager` interface. If your project extends `Agent` and overrides the constructor or any method implementations, consider that you may want to call them from `super`.

- Updated dependencies [[`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c), [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c), [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c)]:
  - @atproto/xrpc@0.6.1

## 0.13.3

### Patch Changes

- [#2735](https://github.com/bluesky-social/atproto/pull/2735) [`4ab248354`](https://github.com/bluesky-social/atproto/commit/4ab2483547d5dabfba88ed4419a4f374bbd7cae7) Thanks [@haileyok](https://github.com/haileyok)! - add `quoteCount` to embed view

## 0.13.2

### Patch Changes

- [#2658](https://github.com/bluesky-social/atproto/pull/2658) [`2a0c088cc`](https://github.com/bluesky-social/atproto/commit/2a0c088cc5d502ca70da9612a261186aa2f2e1fb) Thanks [@haileyok](https://github.com/haileyok)! - Adds `app.bsky.feed.getQuotes` lexicon and handlers

- [#2675](https://github.com/bluesky-social/atproto/pull/2675) [`aba664fbd`](https://github.com/bluesky-social/atproto/commit/aba664fbdfbaddba321e96db2478e0bc8fc72d27) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds `postgate` records to power quote gating and detached quote posts, plus `hiddenReplies` to the `threadgate` record.

## 0.13.1

### Patch Changes

- [#2708](https://github.com/bluesky-social/atproto/pull/2708) [`22af354a5`](https://github.com/bluesky-social/atproto/commit/22af354a5db595d7cbc0e65f02601de3565337e1) Thanks [@devinivy](https://github.com/devinivy)! - Export AtpAgentOptions type to better support extending AtpAgent.

## 0.13.0

### Minor Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)!

  #### Motivation

  The motivation for these changes is the need to make the `@atproto/api` package
  compatible with OAuth session management. We don't have OAuth client support
  "launched" and documented quite yet, so you can keep using the current app
  password authentication system. When we do "launch" OAuth support and begin
  encouraging its usage in the near future (see the [OAuth
  Roadmap](https://github.com/bluesky-social/atproto/discussions/2656)), these
  changes will make it easier to migrate.

  In addition, the redesigned session management system fixes a bug that could
  cause the session data to become invalid when Agent clones are created (e.g.
  using `agent.withProxy()`).

  #### New Features

  We've restructured the `XrpcClient` HTTP fetch handler to be specified during
  the instantiation of the XRPC client, through the constructor, instead of using
  a default implementation (which was statically defined).

  With this refactor, the XRPC client is now more modular and reusable. Session
  management, retries, cryptographic signing, and other request-specific logic can
  be implemented in the fetch handler itself rather than by the calling code.

  A new abstract class named `Agent`, has been added to `@atproto/api`. This class
  will be the base class for all Bluesky agents classes in the `@atproto`
  ecosystem. It is meant to be extended by implementations that provide session
  management and fetch handling.

  As you adapt your code to these changes, make sure to use the `Agent` type
  wherever you expect to receive an agent, and use the `AtpAgent` type (class)
  only to instantiate your client. The reason for this is to be forward compatible
  with the OAuth agent implementation that will also extend `Agent`, and not
  `AtpAgent`.

  ```ts
  import { Agent, AtpAgent } from "@atproto/api";

  async function setupAgent(
    service: string,
    username: string,
    password: string,
  ): Promise<Agent> {
    const agent = new AtpAgent({
      service,
      persistSession: (evt, session) => {
        // handle session update
      },
    });

    await agent.login(username, password);

    return agent;
  }
  ```

  ```ts
  import { Agent } from "@atproto/api";

  async function doStuffWithAgent(agent: Agent, arg: string) {
    return agent.resolveHandle(arg);
  }
  ```

  ```ts
  import { Agent, AtpAgent } from "@atproto/api";

  class MyClass {
    agent: Agent;

    constructor() {
      this.agent = new AtpAgent();
    }
  }
  ```

  #### Breaking changes

  Most of the changes introduced in this version are backward-compatible. However,
  there are a couple of breaking changes you should be aware of:

  - Customizing `fetch`: The ability to customize the `fetch: FetchHandler`
    property of `@atproto/xrpc`'s `Client` and `@atproto/api`'s `AtpAgent` classes
    has been removed. Previously, the `fetch` property could be set to a function
    that would be used as the fetch handler for that instance, and was initialized
    to a default fetch handler. That property is still accessible in a read-only
    fashion through the `fetchHandler` property and can only be set during the
    instance creation. Attempting to set/get the `fetch` property will now result
    in an error.
  - The `fetch()` method, as well as WhatWG compliant `Request` and `Headers`
    constructors, must be globally available in your environment. Use a polyfill
    if necessary.
  - The `AtpBaseClient` has been removed. The `AtpServiceClient` has been renamed
    `AtpBaseClient`. Any code using either of these classes will need to be
    updated.
  - Instead of _wrapping_ an `XrpcClient` in its `xrpc` property, the
    `AtpBaseClient` (formerly `AtpServiceClient`) class - created through
    `lex-cli` - now _extends_ the `XrpcClient` class. This means that a client
    instance now passes the `instanceof XrpcClient` check. The `xrpc` property now
    returns the instance itself and has been deprecated.
  - `setSessionPersistHandler` is no longer available on the `AtpAgent` or
    `BskyAgent` classes. The session handler can only be set though the
    `persistSession` options of the `AtpAgent` constructor.
  - The new class hierarchy is as follows:
    - `BskyAgent` extends `AtpAgent`: but add no functionality (hence its
      deprecation).
    - `AtpAgent` extends `Agent`: adds password based session management.
    - `Agent` extends `AtpBaseClient`: this abstract class that adds syntactic sugar
      methods `app.bsky` lexicons. It also adds abstract session management
      methods and adds atproto specific utilities
      (`labelers` & `proxy` headers, cloning capability)
    - `AtpBaseClient` extends `XrpcClient`: automatically code that adds fully
      typed lexicon defined namespaces (`instance.app.bsky.feed.getPosts()`) to
      the `XrpcClient`.
    - `XrpcClient` is the base class.

  #### Non-breaking changes

  - The `com.*` and `app.*` namespaces have been made directly available to every
    `Agent` instances.

  #### Deprecations

  - The default export of the `@atproto/xrpc` package has been deprecated. Use
    named exports instead.
  - The `Client` and `ServiceClient` classes are now deprecated. They are replaced by a single `XrpcClient` class.
  - The default export of the `@atproto/api` package has been deprecated. Use
    named exports instead.
  - The `BskyAgent` has been deprecated. Use the `AtpAgent` class instead.
  - The `xrpc` property of the `AtpClient` instances has been deprecated. The
    instance itself should be used as the XRPC client.
  - The `api` property of the `AtpAgent` and `BskyAgent` instances has been
    deprecated. Use the instance itself instead.

  #### Migration

  ##### The `@atproto/api` package

  If you were relying on the `AtpBaseClient` solely to perform validation, use
  this:

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import { AtpBaseClient, ComAtprotoSyncSubscribeRepos } from "@atproto/api";

  const baseClient = new AtpBaseClient();

  baseClient.xrpc.lex.assertValidXrpcMessage("io.example.doStuff", {
    // ...
  });
  ```

  </td>
  <td>

  ```ts
  import { lexicons } from "@atproto/api";

  lexicons.assertValidXrpcMessage("io.example.doStuff", {
    // ...
  });
  ```

  </td>
  </tr>
  </table>

  If you are extending the `BskyAgent` to perform custom `session` manipulation, define your own `Agent` subclass instead:

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import { BskyAgent } from "@atproto/api";

  class MyAgent extends BskyAgent {
    private accessToken?: string;

    async createOrRefreshSession(identifier: string, password: string) {
      // custom logic here

      this.accessToken = "my-access-jwt";
    }

    async doStuff() {
      return this.call("io.example.doStuff", {
        headers: {
          Authorization: this.accessToken && `Bearer ${this.accessToken}`,
        },
      });
    }
  }
  ```

  </td>
  <td>

  ```ts
  import { Agent } from "@atproto/api";

  class MyAgent extends Agent {
    private accessToken?: string;
    public did?: string;

    constructor(private readonly service: string | URL) {
      super({
        service,
        headers: {
          Authorization: () =>
            this.accessToken ? `Bearer ${this.accessToken}` : null,
        },
      });
    }

    clone(): MyAgent {
      const agent = new MyAgent(this.service);
      agent.accessToken = this.accessToken;
      agent.did = this.did;
      return this.copyInto(agent);
    }

    async createOrRefreshSession(identifier: string, password: string) {
      // custom logic here

      this.did = "did:example:123";
      this.accessToken = "my-access-jwt";
    }
  }
  ```

  </td>
  </tr>
  </table>

  If you are monkey patching the `xrpc` service client to perform client-side rate limiting, you can now do this in the `FetchHandler` function:

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import { BskyAgent } from "@atproto/api";
  import { RateLimitThreshold } from "rate-limit-threshold";

  const agent = new BskyAgent();
  const limiter = new RateLimitThreshold(3000, 300_000);

  const origCall = agent.api.xrpc.call;
  agent.api.xrpc.call = async function (...args) {
    await limiter.wait();
    return origCall.call(this, ...args);
  };
  ```

  </td>
  <td>

  ```ts
  import { AtpAgent } from "@atproto/api";
  import { RateLimitThreshold } from "rate-limit-threshold";

  class LimitedAtpAgent extends AtpAgent {
    constructor(options: AtpAgentOptions) {
      const fetch: typeof globalThis.fetch = options.fetch ?? globalThis.fetch;
      const limiter = new RateLimitThreshold(3000, 300_000);

      super({
        ...options,
        fetch: async (...args) => {
          await limiter.wait();
          return fetch(...args);
        },
      });
    }
  }
  ```

  </td>
  </tr>
  </table>

  If you configure a static `fetch` handler on the `BskyAgent` class - for example
  to modify the headers of every request - you can now do this by providing your
  own `fetch` function:

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import { BskyAgent, defaultFetchHandler } from "@atproto/api";

  BskyAgent.configure({
    fetch: async (httpUri, httpMethod, httpHeaders, httpReqBody) => {
      const ua = httpHeaders["User-Agent"];

      httpHeaders["User-Agent"] = ua ? `${ua} ${userAgent}` : userAgent;

      return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody);
    },
  });
  ```

  </td>
  <td>

  ```ts
  import { AtpAgent } from "@atproto/api";

  class MyAtpAgent extends AtpAgent {
    constructor(options: AtpAgentOptions) {
      const fetch = options.fetch ?? globalThis.fetch;

      super({
        ...options,
        fetch: async (url, init) => {
          const headers = new Headers(init.headers);

          const ua = headersList.get("User-Agent");
          headersList.set("User-Agent", ua ? `${ua} ${userAgent}` : userAgent);

          return fetch(url, { ...init, headers });
        },
      });
    }
  }
  ```

  </td>
  </tr>
  </table>

  <!-- <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  // before
  ```

  </td>
  <td>

  ```ts
  // after
  ```

  </td>
  </tr>
  </table> -->

  ##### The `@atproto/xrpc` package

  The `Client` and `ServiceClient` classes are now **deprecated**. If you need a
  lexicon based client, you should update the code to use the `XrpcClient` class
  instead.

  The deprecated `ServiceClient` class now extends the new `XrpcClient` class.
  Because of this, the `fetch` `FetchHandler` can no longer be configured on the
  `Client` instances (including the default export of the package). If you are not
  relying on the `fetch` `FetchHandler`, the new changes should have no impact on
  your code. Beware that the deprecated classes will eventually be removed in a
  future version.

  Since its use has completely changed, the `FetchHandler` type has also
  completely changed. The new `FetchHandler` type is now a function that receives
  a `url` pathname and a `RequestInit` object and returns a `Promise<Response>`.
  This function is responsible for making the actual request to the server.

  ```ts
  export type FetchHandler = (
    this: void,
    /**
     * The URL (pathname + query parameters) to make the request to, without the
     * origin. The origin (protocol, hostname, and port) must be added by this
     * {@link FetchHandler}, typically based on authentication or other factors.
     */
    url: string,
    init: RequestInit,
  ) => Promise<Response>;
  ```

  A noticeable change that has been introduced is that the `uri` field of the
  `ServiceClient` class has _not_ been ported to the new `XrpcClient` class. It is
  now the responsibility of the `FetchHandler` to determine the full URL to make
  the request to. The same goes for the `headers`, which should now be set through
  the `FetchHandler` function.

  If you _do_ rely on the legacy `Client.fetch` property to perform custom logic
  upon request, you will need to migrate your code to use the new `XrpcClient`
  class. The `XrpcClient` class has a similar API to the old `ServiceClient`
  class, but with a few differences:

  - The `Client` + `ServiceClient` duality was removed in favor of a single
    `XrpcClient` class. This means that:

    - There no longer exists a centralized lexicon registry. If you need a global
      lexicon registry, you can maintain one yourself using a `new Lexicons` (from
      `@atproto/lexicon`).
    - The `FetchHandler` is no longer a statically defined property of the
      `Client` class. Instead, it is passed as an argument to the `XrpcClient`
      constructor.

  - The `XrpcClient` constructor now requires a `FetchHandler` function as the
    first argument, and an optional `Lexicon` instance as the second argument.
  - The `setHeader` and `unsetHeader` methods were not ported to the new
    `XrpcClient` class. If you need to set or unset headers, you should do so in
    the `FetchHandler` function provided in the constructor arg.

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import client, { defaultFetchHandler } from "@atproto/xrpc";

  client.fetch = function (
    httpUri: string,
    httpMethod: string,
    httpHeaders: Headers,
    httpReqBody: unknown,
  ) {
    // Custom logic here
    return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody);
  };

  client.addLexicon({
    lexicon: 1,
    id: "io.example.doStuff",
    defs: {},
  });

  const instance = client.service("http://my-service.com");

  instance.setHeader("my-header", "my-value");

  await instance.call("io.example.doStuff");
  ```

  </td>
  <td>

  ```ts
  import { XrpcClient } from "@atproto/xrpc";

  const instance = new XrpcClient(
    async (url, init) => {
      const headers = new Headers(init.headers);

      headers.set("my-header", "my-value");

      // Custom logic here

      const fullUrl = new URL(url, "http://my-service.com");

      return fetch(fullUrl, { ...init, headers });
    },
    [
      {
        lexicon: 1,
        id: "io.example.doStuff",
        defs: {},
      },
    ],
  );

  await instance.call("io.example.doStuff");
  ```

  </td>
  </tr>
  </table>

  If your fetch handler does not require any "custom logic", and all you need is
  an `XrpcClient` that makes its HTTP requests towards a static service URL, the
  previous example can be simplified to:

  ```ts
  import { XrpcClient } from "@atproto/xrpc";

  const instance = new XrpcClient("http://my-service.com", [
    {
      lexicon: 1,
      id: "io.example.doStuff",
      defs: {},
    },
  ]);
  ```

  If you need to add static headers to all requests, you can instead instantiate
  the `XrpcClient` as follows:

  ```ts
  import { XrpcClient } from "@atproto/xrpc";

  const instance = new XrpcClient(
    {
      service: "http://my-service.com",
      headers: {
        "my-header": "my-value",
      },
    },
    [
      {
        lexicon: 1,
        id: "io.example.doStuff",
        defs: {},
      },
    ],
  );
  ```

  If you need the headers or service url to be dynamic, you can define them using
  functions:

  ```ts
  import { XrpcClient } from "@atproto/xrpc";

  const instance = new XrpcClient(
    {
      service: () => "http://my-service.com",
      headers: {
        "my-header": () => "my-value",
        "my-ignored-header": () => null, // ignored
      },
    },
    [
      {
        lexicon: 1,
        id: "io.example.doStuff",
        defs: {},
      },
    ],
  );
  ```

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add the ability to use `fetch()` compatible `BodyInit` body when making XRPC calls.

### Patch Changes

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`2bdf75d7a`](https://github.com/bluesky-social/atproto/commit/2bdf75d7a63924c10e7a311f16cb447d595b933e), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd)]:
  - @atproto/lexicon@0.4.1
  - @atproto/xrpc@0.6.0

## 0.12.29

### Patch Changes

- [#2668](https://github.com/bluesky-social/atproto/pull/2668) [`dc471da26`](https://github.com/bluesky-social/atproto/commit/dc471da267955d0962a8affaf983df60d962d97c) Thanks [@dholms](https://github.com/dholms)! - Add lxm and exp parameters to com.atproto.server.getServiceAuth

## 0.12.28

### Patch Changes

- [#2676](https://github.com/bluesky-social/atproto/pull/2676) [`951a3df15`](https://github.com/bluesky-social/atproto/commit/951a3df15aa9c1f5b0a2b66cfb0e2eaf6198fe41) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Remove `app.bsky.feed.detach` record, to be replaced by `app.bsky.feed.postgate` record in a future release.

## 0.12.27

### Patch Changes

- [#2664](https://github.com/bluesky-social/atproto/pull/2664) [`ff803fd2b`](https://github.com/bluesky-social/atproto/commit/ff803fd2bfad92eec5f88ee9b347c174731ef4ec) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds `app.bsky.feed.detach` record lexicons.

## 0.12.26

### Patch Changes

- [#2276](https://github.com/bluesky-social/atproto/pull/2276) [`77c5306d2`](https://github.com/bluesky-social/atproto/commit/77c5306d2a40d7edd20def73163b8f93f3a30ee7) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Updates muted words lexicons to include new attributes `id`, `actorTarget`, and `expiresAt`. Adds and updates methods in API SDK for better management of muted words.

## 0.12.25

### Patch Changes

- [#2570](https://github.com/bluesky-social/atproto/pull/2570) [`12dcdb668`](https://github.com/bluesky-social/atproto/commit/12dcdb668c8ec0f8a89689c326ab3e9dbc6d2f3c) Thanks [@sugyan](https://github.com/sugyan)! - Fix `hasMutedWord` for facets with multiple features

- [#2648](https://github.com/bluesky-social/atproto/pull/2648) [`76c91f832`](https://github.com/bluesky-social/atproto/commit/76c91f8325363c95e25349e8e236aa2f70e63d5b) Thanks [@dholms](https://github.com/dholms)! - Support for priority notifications

## 0.12.24

### Patch Changes

- [#2613](https://github.com/bluesky-social/atproto/pull/2613) [`ed5810179`](https://github.com/bluesky-social/atproto/commit/ed5810179006f254f2035fe1f0e3c4798080cfe0) Thanks [@haileyok](https://github.com/haileyok)! - Support for starter packs in record embed views.

- [#2554](https://github.com/bluesky-social/atproto/pull/2554) [`0529bec99`](https://github.com/bluesky-social/atproto/commit/0529bec99183439829a3553f45ac7203763144c3) Thanks [@sugyan](https://github.com/sugyan)! - Add missing `getPreferences` union return types

## 0.12.23

### Patch Changes

- [#2492](https://github.com/bluesky-social/atproto/pull/2492) [`bc861a2c2`](https://github.com/bluesky-social/atproto/commit/bc861a2c25b4151fb7e070dc20d5e1e07da21863) Thanks [@pfrazee](https://github.com/pfrazee)! - Added bsky app state preference and improved protections against race conditions in preferences sdk

## 0.12.22

### Patch Changes

- [#2553](https://github.com/bluesky-social/atproto/pull/2553) [`af7d3912a`](https://github.com/bluesky-social/atproto/commit/af7d3912a3b304a752ed72947eaa8cf28b35ec02) Thanks [@devinivy](https://github.com/devinivy)! - Support for starter packs (app.bsky.graph.starterpack)

## 0.12.21

### Patch Changes

- [#2460](https://github.com/bluesky-social/atproto/pull/2460) [`3ad051996`](https://github.com/bluesky-social/atproto/commit/3ad0519961e2437aa4870bf1358e6c275dcdee24) Thanks [@foysalit](https://github.com/foysalit)! - Add DB backed team member management for ozone

## 0.12.20

### Patch Changes

- [#2582](https://github.com/bluesky-social/atproto/pull/2582) [`ea0f10b5d`](https://github.com/bluesky-social/atproto/commit/ea0f10b5d0d334eb587032c54d5ace9ea811cf26) Thanks [@pfrazee](https://github.com/pfrazee)! - Remove client-side enforcement of labeler limits

## 0.12.19

### Patch Changes

- [#2558](https://github.com/bluesky-social/atproto/pull/2558) [`7c1973841`](https://github.com/bluesky-social/atproto/commit/7c1973841dab416ae19435d37853aeea1f579d39) Thanks [@dholms](https://github.com/dholms)! - Add thread mute routes and viewer state

## 0.12.18

### Patch Changes

- [#2557](https://github.com/bluesky-social/atproto/pull/2557) [`58abcbd8b`](https://github.com/bluesky-social/atproto/commit/58abcbd8b6e42a1f66bda6acc3ee6a2c0894e546) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds "social proof": `knowFollowers` to `ViewerState` for `ProfileViewDetailed`
  views and `app.bsky.graph.getKnownFollowers` method for listing known followers
  of a given user.

## 0.12.17

### Patch Changes

- [#2426](https://github.com/bluesky-social/atproto/pull/2426) [`2b21b5be2`](https://github.com/bluesky-social/atproto/commit/2b21b5be293d32c5eb5ae971c39703bc7d2224fd) Thanks [@foysalit](https://github.com/foysalit)! - Add com.atproto.admin.searchAccounts lexicon to allow searching for accounts using email address

## 0.12.16

### Patch Changes

- [#2539](https://github.com/bluesky-social/atproto/pull/2539) [`9495af23b`](https://github.com/bluesky-social/atproto/commit/9495af23bdb328cfc71182ac80e6eb61863d7a46) Thanks [@dholms](https://github.com/dholms)! - Allow updating deactivation state through admin.updateSubjectStatus

## 0.12.15

### Patch Changes

- [#2531](https://github.com/bluesky-social/atproto/pull/2531) [`255d5ea1f`](https://github.com/bluesky-social/atproto/commit/255d5ea1f06726547cdbe59c83bd18f2d4746912) Thanks [@dholms](https://github.com/dholms)! - Account deactivation. Current hosting status returned on session routes.

## 0.12.14

### Patch Changes

- [#2533](https://github.com/bluesky-social/atproto/pull/2533) [`c4af6a409`](https://github.com/bluesky-social/atproto/commit/c4af6a409ea2171c3cf1d0e7c8ed496794a3f049) Thanks [@devinivy](https://github.com/devinivy)! - Support for post embeds in chat lexicons

## 0.12.13

### Patch Changes

- [#2517](https://github.com/bluesky-social/atproto/pull/2517) [`1d4ab5d04`](https://github.com/bluesky-social/atproto/commit/1d4ab5d046aac4539658ee6d7e61882c54d5beb9) Thanks [@dholms](https://github.com/dholms)! - Add privileged flag to app password routes

## 0.12.12

### Patch Changes

- [#2442](https://github.com/bluesky-social/atproto/pull/2442) [`1f560f021`](https://github.com/bluesky-social/atproto/commit/1f560f021c07eb9e8d76577e67fd2d7ac39cdee4) Thanks [@foysalit](https://github.com/foysalit)! - Add com.atproto.label.queryLabels endpoint on appview and allow viewing external labels through ozone

## 0.12.11

### Patch Changes

- [#2499](https://github.com/bluesky-social/atproto/pull/2499) [`06d2328ee`](https://github.com/bluesky-social/atproto/commit/06d2328eeb8d706018dbdf7cc7b9862dd65b96cb) Thanks [@devinivy](https://github.com/devinivy)! - Misc tweaks and fixes to chat lexicons

## 0.12.10

### Patch Changes

- [#2485](https://github.com/bluesky-social/atproto/pull/2485) [`d32f7215f`](https://github.com/bluesky-social/atproto/commit/d32f7215f69bc87f50890d9cfdb09840c2fbaa41) Thanks [@devinivy](https://github.com/devinivy)! - Add lexicons for chat.bsky namespace

## 0.12.9

### Patch Changes

- [#2467](https://github.com/bluesky-social/atproto/pull/2467) [`f83b4c8ca`](https://github.com/bluesky-social/atproto/commit/f83b4c8cad01cebc1b67caa6c7ebe45f07b2f318) Thanks [@haileyok](https://github.com/haileyok)! - Modify label-handling on user's own content to still apply blurring

## 0.12.8

### Patch Changes

- [`58f719cc1`](https://github.com/bluesky-social/atproto/commit/58f719cc1c8d0ebd5ad7cf11221372b671cd7857) Thanks [@devinivy](https://github.com/devinivy)! - Add grandparent author to feed item reply ref

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
