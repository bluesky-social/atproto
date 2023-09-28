# Moderation API

Applying the moderation system is a challenging task, but we've done our best to simplify it for you. The Moderation API helps handle a wide range of tasks, including:

- User muting (including mutelists)
- User blocking
- Moderator labeling

For more information, see the [Moderation Documentation](./docs/moderation.md) or the associated [Labels Reference](./docs/labels.md).

Additional docs:

- [Labels Reference](./labels.md)
- [Post Moderation Behaviors](./moderation-behaviors/posts.md)
- [Profile Moderation Behaviors](./moderation-behaviors/profiles.md)

## Configuration

Every moderation function takes a set of options which look like this:

```typescript
{
  // the logged-in user's DID
  userDid: 'did:plc:1234...',

  // is adult content allowed?
  adultContentEnabled: true,

  // the global label settings (used on self-labels)
  labels: {
    porn: 'hide',
    sexual: 'warn',
    nudity: 'ignore',
    // ...
  },

  // the per-labeler settings
  labelers: [
    {
      labeler: {
        did: '...',
        displayName: 'My mod service'
      },
      labels: {
        porn: 'hide',
        sexual: 'warn',
        nudity: 'ignore',
        // ...
      }
    }
  ]
}
```

This should match the following interfaces:

```typescript
interface ModerationOpts {
  userDid: string
  adultContentEnabled: boolean
  labels: Record<string, LabelPreference>
  labelers: LabelerSettings[]
}

interface Labeler {
  did: string
  displayName: string
}

type LabelPreference = 'ignore' | 'warn' | 'hide'

interface LabelerSettings {
  labeler: Labeler
  labels: Record<string, LabelPreference>
}
```

## Posts

Applications need to produce the [Post Moderation Behaviors](./moderation-behaviors/posts.md) using the `moderatePost()` API.

```typescript
import { moderatePost } from '@atproto/api'

const postMod = moderatePost(postView, getOpts())

if (postMod.content.filter) {
  // dont render in feeds or similar
  // in contexts where this is disruptive (eg threads) you should ignore this and instead check blur
}
if (postMod.content.blur) {
  // render the whole object behind a cover (use postMod.content.cause to explain)
  if (postMod.content.noOverride) {
    // do not allow the cover the be removed
  }
}
if (postMod.content.alert) {
  // render a warning on the content (use postMod.content.cause to explain)
}
if (postMod.embed.blur) {
  // render the embedded media behind a cover (use postMod.embed.cause to explain)
  if (postMod.embed.noOverride) {
    // do not allow the cover the be removed
  }
}
if (postMod.embed.alert) {
  // render a warning on the embedded media (use postMod.embed.cause to explain)
}
if (postMod.avatar.blur) {
  // render the avatar behind a cover
}
if (postMod.avatar.alert) {
  // render an alert on the avatar
}
```

## Profiles

Applications need to produce the [Profile Moderation Behaviors](./moderation-behaviors/profiles.md) using the `moderateProfile()` API.

```typescript
import { moderateProfile } from '@atproto/api'

const profileMod = moderateProfile(profileView, getOpts())

if (profileMod.acount.filter) {
  // dont render in discovery
}
if (profileMod.account.blur) {
  // render the whole account behind a cover (use profileMod.account.cause to explain)
  if (profileMod.account.noOverride) {
    // do not allow the cover the be removed
  }
}
if (profileMod.account.alert) {
  // render a warning on the account (use profileMod.account.cause to explain)
}
if (profileMod.profile.blur) {
  // render the profile information (display name, bio) behind a cover
  if (profileMod.profile.noOverride) {
    // do not allow the cover the be removed
  }
}
if (profileMod.profile.alert) {
  // render a warning on the profile (use profileMod.profile.cause to explain)
}
if (profileMod.avatar.blur) {
  // render the avatar behind a cover
}
if (profileMod.avatar.alert) {
  // render an alert on the avatar
}
```
