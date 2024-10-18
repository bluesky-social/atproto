# Moderation API

Applying the moderation system is a challenging task, but we've done our best to simplify it for you. The Moderation API helps handle a wide range of tasks, including:

- Moderator labeling
- User muting (including mutelists)
- User blocking
- Mutewords
- Hidden posts

## Configuration

Every moderation function takes a set of options which look like this:

```typescript
{
  // the logged-in user's DID
  userDid: 'did:plc:1234...',

  moderationPrefs: {
    // is adult content allowed?
    adultContentEnabled: true,

    // the global label settings (used on self-labels)
    labels: {
      porn: 'hide',
      sexual: 'warn',
      nudity: 'ignore',
      // ...
    },

    // the subscribed labelers and their label settings
    labelers: [
      {
        did: 'did:plc:1234...',
        labels: {
          porn: 'hide',
          sexual: 'warn',
          nudity: 'ignore',
          // ...
        }
      }
    ],

    mutedWords: [/* ... */],
    hiddenPosts: [/* ... */]
  },

  // custom label definitions
  labelDefs: {
    // labelerDid => defs[]
    'did:plc:1234...': [
      /* ... */
    ]
  }
}
```

This should match the following interfaces:

```typescript
export interface ModerationPrefsLabeler {
  did: string
  labels: Record<string, LabelPreference>
}

export interface ModerationPrefs {
  adultContentEnabled: boolean
  labels: Record<string, LabelPreference>
  labelers: ModerationPrefsLabeler[]
  mutedWords: AppBskyActorDefs.MutedWord[]
  hiddenPosts: string[]
}

export interface ModerationOpts {
  userDid: string | undefined
  prefs: ModerationPrefs
  /**
   * Map of labeler did -> custom definitions
   */
  labelDefs?: Record<string, InterpretedLabelValueDefinition[]>
}
```

You can quickly grab the `ModerationPrefs` using the `agent.getPreferences()` method:

```typescript
const prefs = await agent.getPreferences()
moderatePost(post, {
  userDid: /*...*/,
  prefs: prefs.moderationPrefs,
  labelDefs: /*...*/
})
```

To gather the label definitions (`labelDefs`) see the _Labelers_ section below.

## Labelers

Labelers are services that provide moderation labels. Your application will typically have 1+ top-level labelers set with the ability to do "takedowns" on content. This is controlled via this static function, though the default is to use Bluesky's moderation:

```typescript
BskyAgent.configure({
  appLabelers: ['did:web:my-labeler.com'],
})
```

Users may also add their own labelers. The active labelers are controlled via an HTTP header which is automatically set by the agent when `getPreferences` is called, or when the labeler preferences are changed.

Labelers publish a `app.bsky.labeler.service` record that looks like this:

```js
{
  $type: 'app.bsky.labeler.service',
  policies: {
    // the list of label values the labeler will publish
    labelValues: [
      'rude',
    ],
    // any custom definitions the labeler will be using
    labelValueDefinitions: [
      {
        identifier: 'rude',
        blurs: 'content',
        severity: 'alert',
        defaultSetting: 'warn',
        adultOnly: false,
        locales: [
          {
            lang: 'en',
            name: 'Rude',
            description: 'Not keeping things civil.',
          },
        ],
      },
    ],
  },
  createdAt: '2024-03-12T17:17:17.215Z'
}
```

The label value definition are custom labels which only apply to that labeler. Your client needs to sync those definitions in order to correctly interpret them. To do that, call `app.bsky.labeler.getService()` (or the `getServices` batch variant) periodically to fetch their definitions. We recommend caching the response (at time our writing the official client uses a TTL of 6 hours).

Here is how to do this:

```typescript
import { AtpAgent } from '@atproto/api'

const agent = new AtpAgent({ service: 'https://example.com' })
// assume `agent` is a signed in session
const prefs = await agent.getPreferences()
const labelDefs = await agent.getLabelDefinitions(prefs)

moderatePost(post, {
  userDid: agent.session.did,
  prefs: prefs.moderationPrefs,
  labelDefs,
})
```

## The `moderate*()` APIs

The SDK exports methods to moderate the different kinds of content on the network.

```typescript
import {
  moderateProfile,
  moderatePost,
  moderateNotification,
  moderateFeedGen,
  moderateUserList,
  moderateLabeler,
} from '@atproto/api'
```

Each of these follows the same API signature:

```typescript
const res = moderatePost(post, moderationOptions)
```

The response object provides an API for figuring out what your UI should do in different contexts.

```typescript
res.ui(context) /* =>

ModerationUI {
  filter: boolean // should the content be removed from the interface?
  blur: boolean // should the content be put behind a cover?
  alert: boolean // should an alert be put on the content? (negative)
  inform: boolean // should an informational notice be put on the content? (neutral)
  noOverride: boolean // if blur=true, should the UI disable opening the cover?

  // the reasons for each of the flags:
  filters: ModerationCause[]
  blurs: ModerationCause[]
  alerts: ModerationCause[]
  informs: ModerationCause[]
}
*/
```

There are multiple UI contexts available:

- `profileList` A profile being listed, eg in search or a follower list
- `profileView` A profile being viewed directly
- `avatar` The user's avatar in any context
- `banner` The user's banner in any context
- `displayName` The user's display name in any context
- `contentList` Content being listed, eg posts in a feed, posts as replies, a user list list, a feed generator list, etc
- `contentView` Content being viewed direct, eg an opened post, the user list page, the feedgen page, etc
- `contentMedia ` Media inside the content, eg a picture embedded in a post

Here's how a post in a feed would use these tools to make a decision:

```typescript
const mod = moderatePost(post, moderationOptions)

if (mod.ui('contentList').filter) {
  // dont show the post
}
if (mod.ui('contentList').blur) {
  // cover the post with the explanation from mod.ui('contentList').blurs[0]
  if (mod.ui('contentList').noOverride) {
    // dont allow the cover to be removed
  }
}
if (mod.ui('contentMedia').blur) {
  // cover the post's embedded images with the explanation from mod.ui('contentMedia').blurs[0]
  if (mod.ui('contentMedia').noOverride) {
    // dont allow the cover to be removed
  }
}
if (mod.ui('avatar').blur) {
  // cover the avatar with the explanation from mod.ui('avatar').blurs[0]
  if (mod.ui('avatar').noOverride) {
    // dont allow the cover to be removed
  }
}
for (const alert of mod.ui('contentList').alerts) {
  // render this alert
}
for (const inform of mod.ui('contentList').informs) {
  // render this inform
}
```

## Sending moderation reports

Any Labeler is capable of receiving moderation reports. As a result, you need to specify which labeler should receive the report. You do this with the `Atproto-Proxy` header:

```typescript
agent
  .withProxy('atproto_labeler', 'did:web:my-labeler.com')
  .createModerationReport({
    reasonType: 'com.atproto.moderation.defs#reasonViolation',
    reason: 'They were being such a jerk to me!',
    subject: { did: 'did:web:bob.com' },
  })
```
