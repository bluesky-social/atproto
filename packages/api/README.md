# ATP API

This API is a client for ATProtocol servers. It communicates using HTTP. It includes:

- ✔️ APIs for ATProto and Bluesky.
- ✔️ Validation and complete typescript types.
- ✔️ Session management.
- ✔️ A RichText library.

## Getting started

First install the package:

```
yarn add @atproto/api
```

Then in your application:

```typescript
import { BskyAgent } from '@atproto/api'

const agent = new BskyAgent({ service: 'https://example.com' })
```

## Usage

### Session management

Log into a server or create accounts using these APIs. You'll need an active session for most methods.

```typescript
import { BskyAgent, AtpSessionEvent, AtpSessionData } from '@atproto/api'

// configure connection to the server, without account authentication
const agent = new BskyAgent({
  service: 'https://example.com',
  persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
    // store the session-data for reuse
  },
})

// create a new account on the server
await agent.createAccount({
  email: 'alice@mail.com',
  password: 'hunter2',
  handle: 'alice.example.com',
  inviteCode: 'some-code-12345-abcde',
})

// if an existing session (accessed with 'agent.session') was securely stored previously, then reuse that
await agent.resumeSession(savedSessionData)

// if no old session was available, create a new one by logging in with password (App Password)
await agent.login({ identifier: 'alice@mail.com', password: 'hunter2' })
```

### API calls

The agent includes methods for many common operations, including:

```typescript
// Feeds and content
await agent.getTimeline(params, opts)
await agent.getAuthorFeed(params, opts)
await agent.getPostThread(params, opts)
await agent.getPost(params)
await agent.getPosts(params, opts)
await agent.getLikes(params, opts)
await agent.getRepostedBy(params, opts)
await agent.post(record)
await agent.deletePost(postUri)
await agent.like(uri, cid)
await agent.deleteLike(likeUri)
await agent.repost(uri, cid)
await agent.deleteRepost(repostUri)
await agent.uploadBlob(data, opts)

// Social graph
await agent.getFollows(params, opts)
await agent.getFollowers(params, opts)
await agent.follow(did)
await agent.deleteFollow(followUri)

// Actors
await agent.getProfile(params, opts)
await agent.upsertProfile(updateFn)
await agent.getProfiles(params, opts)
await agent.getSuggestions(params, opts)
await agent.searchActors(params, opts)
await agent.searchActorsTypeahead(params, opts)
await agent.mute(did)
await agent.unmute(did)
await agent.muteModList(listUri)
await agent.unmuteModList(listUri)
await agent.blockModList(listUri)
await agent.unblockModList(listUri)

// Notifications
await agent.listNotifications(params, opts)
await agent.countUnreadNotifications(params, opts)
await agent.updateSeenNotifications()

// Identity
await agent.resolveHandle(params, opts)
await agent.updateHandle(params, opts)

// Session management
await agent.createAccount(params)
await agent.login(params)
await agent.resumeSession(session)
```

### Validation and types

The package includes a complete types system which includes validation and type-guards. For example, to validate a post record:

```typescript
import { AppBskyFeedPost } from '@atproto/api'

const post = {...}
if (AppBskyFeedPost.isRecord(post)) {
  // typescript now recognizes `post` as a AppBskyFeedPost.Record
  // however -- we still need to validate it
  const res = AppBskyFeedPost.validateRecord(post)
  if (res.success) {
    // a valid record
  } else {
    // something is wrong
    console.log(res.error)
  }
}
```

### Rich text

Some records (ie posts) use the `app.bsky.richtext` lexicon. At the moment richtext is only used for links and mentions, but it will be extended over time to include bold, italic, and so on.

ℹ️ It is **strongly** recommended to use this package's `RichText` library. Javascript encodes strings in utf16 while the protocol (and most other programming environments) use utf8. Converting between the two is challenging, but `RichText` handles that for you.

```typescript
import { RichText } from '@atproto/api'

// creating richtext
const rt = new RichText({
  text: 'Hello @alice.com, check out this link: https://example.com',
})
await rt.detectFacets(agent) // automatically detects mentions and links
const postRecord = {
  $type: 'app.bsky.feed.post',
  text: rt.text,
  facets: rt.facets,
  createdAt: new Date().toISOString(),
}

// rendering as markdown
let markdown = ''
for (const segment of rt.segments()) {
  if (segment.isLink()) {
    markdown += `[${segment.text}](${segment.link?.uri})`
  } else if (segment.isMention()) {
    markdown += `[${segment.text}](https://my-bsky-app.com/user/${segment.mention?.did})`
  } else {
    markdown += segment.text
  }
}

// calculating string lengths
const rt2 = new RichText({ text: 'Hello' })
console.log(rt2.length) // => 5
console.log(rt2.graphemeLength) // => 5
const rt3 = new RichText({ text: '👨‍👩‍👧‍👧' })
console.log(rt3.length) // => 25
console.log(rt3.graphemeLength) // => 1
```

### Moderation

Applying the moderation system is a challenging task, but we've done our best to simplify it for you. The Moderation API helps handle a wide range of tasks, including:

- Moderator labeling
- User muting (including mutelists)
- User blocking
- Mutewords
- Hidden posts

For more information, see the [Moderation Documentation](./docs/moderation.md).

```typescript
import { moderatePost } from '@atproto/api'

// First get the user's moderation prefs and their label definitions
// =

const prefs = await agent.getPreferences()
const labelDefs = await agent.getLabelDefinitions(prefs)

// We call the appropriate moderation function for the content
// =

const postMod = moderatePost(postView, {
  userDid: agent.session.did,
  moderationPrefs: prefs.moderationPrefs,
  labelDefs,
})

// We then use the output to decide how to affect rendering
// =

// in feeds
if (postMod.ui('contentList').filter) {
  // don't include in feeds
}
if (postMod.ui('contentList').blur) {
  // render the whole object behind a cover (use postMod.ui('contentList').blurs to explain)
  if (postMod.ui('contentList').noOverride) {
    // do not allow the cover the be removed
  }
}
if (postMod.ui('contentList').alert || postMod.ui('contentList').inform) {
  // render warnings on the post
  // find the warnings in postMod.ui('contentList').alerts and postMod.ui('contentList').informs
}

// viewed directly
if (postMod.ui('contentView').filter) {
  // don't include in feeds
}
if (postMod.ui('contentView').blur) {
  // render the whole object behind a cover (use postMod.ui('contentView').blurs to explain)
  if (postMod.ui('contentView').noOverride) {
    // do not allow the cover the be removed
  }
}
if (postMod.ui('contentView').alert || postMod.ui('contentView').inform) {
  // render warnings on the post
  // find the warnings in postMod.ui('contentView').alerts and postMod.ui('contentView').informs
}

// post embeds in all contexts
if (postMod.ui('contentMedia').blur) {
  // render the whole object behind a cover (use postMod.ui('contentMedia').blurs to explain)
  if (postMod.ui('contentMedia').noOverride) {
    // do not allow the cover the be removed
  }
}
```

## Advanced

### Advanced API calls

The methods above are convenience wrappers. It covers most but not all available methods.

The AT Protocol identifies methods and records with reverse-DNS names. You can use them on the agent as well:

```typescript
const res1 = await agent.com.atproto.repo.createRecord({
  did: alice.did,
  collection: 'app.bsky.feed.post',
  record: {
    $type: 'app.bsky.feed.post',
    text: 'Hello, world!',
    createdAt: new Date().toISOString(),
  },
})
const res2 = await agent.com.atproto.repo.listRecords({
  repo: alice.did,
  collection: 'app.bsky.feed.post',
})

const res3 = await agent.app.bsky.feed.post.create(
  { repo: alice.did },
  {
    text: 'Hello, world!',
    createdAt: new Date().toISOString(),
  },
)
const res4 = await agent.app.bsky.feed.post.list({ repo: alice.did })
```

### Generic agent

If you want a generic AT Protocol agent without methods related to the Bluesky social lexicon, use the `AtpAgent` instead of the `BskyAgent`.

```typescript
import { AtpAgent } from '@atproto/api'

const agent = new AtpAgent({ service: 'https://example.com' })
```

### Non-browser configuration

In non-browser environments you'll need to specify a fetch polyfill. [See the example react-native polyfill here.](./docs/rn-fetch-handler.ts)

```typescript
import { BskyAgent } from '@atproto/api'

const agent = new BskyAgent({ service: 'https://example.com' })

// provide a custom fetch implementation (shouldn't be needed in node or the browser)
import {
  AtpAgentFetchHeaders,
  AtpAgentFetchHandlerResponse,
} from '@atproto/api'
BskyAgent.configure({
  async fetch(
    httpUri: string,
    httpMethod: string,
    httpHeaders: AtpAgentFetchHeaders,
    httpReqBody: any,
  ): Promise<AtpAgentFetchHandlerResponse> {
    // insert definition here...
    return { status: 200 /*...*/ }
  },
})
```

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
