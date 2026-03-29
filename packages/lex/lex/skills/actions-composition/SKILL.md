---
name: actions-composition
description: >
  Building composable Action<Input, Output> functions combining multiple XRPC
  calls. client.call(action, input, options). Higher-order Actions composing
  other Actions. Retry patterns with swapRecord/swapCommit. Packaging Actions
  as individually exported functions for tree-shaking. assertAuthenticated,
  forward options/signal, explicit type parameters.
type: core
library: '@atproto/lex'
library_version: '0.0.20'
requires:
  - atproto-lex/client-api
sources:
  - 'bluesky-social/atproto:packages/lex/lex/README.md'
  - 'bluesky-social/atproto:packages/lex/lex-client/src/client.ts'
---

# Actions Composition

> **Dependency:** This skill builds on [atproto-lex/client-api](../client-api/SKILL.md). Read it first.

Composable `Action<Input, Output>` functions that combine multiple XRPC calls
into higher-level operations, invokable through `client.call()` just like
Lexicon methods.

## Setup

Define and use a simple Action:

```typescript
import { Action, Client, l } from '@atproto/lex'
import * as app from './lexicons/app.js'

// An Action is a function: (client, input, options) => Output | Promise<Output>
export const likePost: Action<
  { uri: string; cid: string },
  { uri: string; cid: string }
> = async (client, { uri, cid }, options) => {
  client.assertAuthenticated()

  return client.create(
    app.bsky.feed.like,
    {
      subject: { uri, cid },
      createdAt: l.currentDatetimeString(),
    },
    options,
  )
}

// Invoke via client.call() -- same interface as XRPC queries and procedures
const client = new Client(oauthSession)
const result = await client.call(likePost, {
  uri: 'at://did:plc:abc/app.bsky.feed.post/123',
  cid: 'bafyreiabc...',
})
console.log(result.uri) // at://did:plc:.../app.bsky.feed.like/...
```

`client.call()` dispatches to the Action function, passing the `Client`
instance, the input, and any `CallOptions` (signal, headers, labelers). The
return type is inferred from the Action's `Output` type parameter.

## Core Patterns

### 1. Composing Actions

Actions that combine multiple XRPC calls into a single logical operation.

```typescript
import { Action, Client, l } from '@atproto/lex'
import * as app from './lexicons/app.js'

type PostInput = Partial<app.bsky.feed.post.Main> &
  Omit<app.bsky.feed.post.Main, 'createdAt'>

// Create a post with optional defaults
export const post: Action<PostInput, { uri: string; cid: string }> = async (
  client,
  record,
  options,
) => {
  client.assertAuthenticated()

  return client.create(
    app.bsky.feed.post,
    {
      ...record,
      createdAt: record.createdAt || l.currentDatetimeString(),
    },
    options,
  )
}

// Post-and-like: compose two operations into one Action
export const postAndLike: Action<
  PostInput,
  { postUri: string; postCid: string; likeUri: string }
> = async (client, input, options) => {
  client.assertAuthenticated()

  // First, create the post
  const created = await post(client, input, options)

  // Then, like it
  const like = await likePost(
    client,
    { uri: created.uri, cid: created.cid },
    options,
  )

  return {
    postUri: created.uri,
    postCid: created.cid,
    likeUri: like.uri,
  }
}

// Usage
const result = await client.call(postAndLike, {
  text: 'Hello, AT Protocol!',
  langs: ['en'],
})
```

Actions compose by calling each other directly as functions, passing through
`client` and `options`. This keeps abort signals, custom headers, and labeler
configuration flowing through the entire call chain.

### 2. Higher-Order Actions (updatePreferences pattern)

A generic Action that accepts a transform function, with specialized Actions
built on top.

```typescript
import { Action } from '@atproto/lex'
import * as app from './lexicons/app.js'

type Preference = app.bsky.actor.defs.Preferences[number]

// Low-level: apply an arbitrary transform to the preference list
export const updatePreferences: Action<
  (prefs: Preference[]) => Preference[] | false,
  Preference[]
> = async (client, updateFn, options) => {
  client.assertAuthenticated()

  const { preferences } = await client.call(
    app.bsky.actor.getPreferences,
    options,
  )

  const updated = updateFn(preferences)
  if (updated === false) return preferences

  await client.call(
    app.bsky.actor.putPreferences,
    { preferences: updated },
    options,
  )

  return updated
}

// Mid-level: upsert a single preference by $type
export const upsertPreference: Action<Preference, Preference[]> = async (
  client,
  pref,
  options,
) => {
  return updatePreferences(
    client,
    (prefs) => [...prefs.filter((p) => p.$type !== pref.$type), pref],
    options,
  )
}

// High-level: toggle adult content with zero input
export const enableAdultContent: Action<void, Preference[]> = async (
  client,
  _,
  options,
) => {
  return upsertPreference(
    client,
    app.bsky.actor.defs.adultContentPref.build({ enabled: true }),
    options,
  )
}

// Usage -- each level is callable via client.call()
await client.call(enableAdultContent)

await client.call(
  upsertPreference,
  app.bsky.actor.defs.adultContentPref.build({ enabled: false }),
)

await client.call(updatePreferences, (prefs) =>
  prefs.filter((p) => !app.bsky.actor.defs.adultContentPref.check(p)),
)
```

The `void` input type on `enableAdultContent` means `client.call()` does not
require a second argument. TypeScript enforces this at the call site.

### 3. Retry with Optimistic Concurrency

Use `swapRecord` to detect concurrent modifications and retry on conflict.

```typescript
import { Action, XrpcResponseError } from '@atproto/lex'
import * as app from './lexicons/app.js'
import * as com from './lexicons/com.js'

type ProfileUpdate = Partial<Omit<app.bsky.actor.profile.Main, '$type'>>

export const updateProfile: Action<ProfileUpdate, void> = async (
  client,
  updates,
  options,
) => {
  client.assertAuthenticated()

  const maxRetries = 5
  for (let attempt = 0; ; attempt++) {
    try {
      // Fetch the current profile record and its CID
      const res = await client.xrpc(com.atproto.repo.getRecord, {
        ...options,
        params: {
          repo: client.assertDid,
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
        },
      })

      const current = app.bsky.actor.profile.main.validate(res.body.record)

      // Merge updates into the current record
      const merged = app.bsky.actor.profile.main.build({
        ...(current.success ? current.value : undefined),
        ...updates,
      })

      // Write back with swapRecord -- fails if CID changed since our read
      await client.put(app.bsky.actor.profile, merged, {
        ...options,
        swapRecord: res.body.cid ?? null,
      })

      return
    } catch (error) {
      if (
        error instanceof XrpcResponseError &&
        error.name === 'SwapError' &&
        attempt < maxRetries - 1
      ) {
        continue // CID changed, re-read and try again
      }
      throw error
    }
  }
}

// Usage
await client.call(updateProfile, { displayName: 'Alice', description: 'Hello!' })
```

The `swapRecord` field tells the PDS "only apply this write if the record
still has this CID." If another client modified the profile between the read
and the write, the PDS returns a `SwapError` and the loop retries with the
fresh state.

## Common Mistakes

### HIGH: Not calling `assertAuthenticated` in Actions

Actions receive a `Client` that may be unauthenticated. Methods like
`client.create()` and `client.assertDid` will throw, but the error message is
generic ("Client is not authenticated"). Calling `assertAuthenticated()` at the
top of your Action makes failures obvious and narrows the `client.did` type
from `DidString | undefined` to `DidString`.

```typescript
// WRONG: cryptic error deep in the call chain
const myAction: Action<{ text: string }, { uri: string; cid: string }> = async (
  client,
  input,
  options,
) => {
  return client.create(app.bsky.feed.post, {
    text: input.text,
    createdAt: l.currentDatetimeString(),
  }, options)
}

// CORRECT: fail fast with a clear message, narrow the type
const myAction: Action<{ text: string }, { uri: string; cid: string }> = async (
  client,
  input,
  options,
) => {
  client.assertAuthenticated()
  return client.create(app.bsky.feed.post, {
    text: input.text,
    createdAt: l.currentDatetimeString(),
  }, options)
}
```

### HIGH: Not forwarding options/signal to sub-calls

Actions receive `CallOptions` containing `signal`, `headers`, `labelers`, and
`service`. Every sub-call must receive these options, or abort signals are
ignored and custom headers/labelers are silently dropped.

```typescript
// WRONG: options not forwarded -- abort signal ignored, headers lost
const fetchAndLike: Action<{ actor: string }, void> = async (
  client,
  { actor },
  options,
) => {
  const data = await client.call(app.bsky.feed.getAuthorFeed, { actor })
  // ...
}

// CORRECT: pass options through to every sub-call
const fetchAndLike: Action<{ actor: string }, void> = async (
  client,
  { actor },
  options,
) => {
  const data = await client.call(
    app.bsky.feed.getAuthorFeed,
    { actor },
    options,
  )
  // ...
}
```

When composing Actions that call other Actions, pass the same `options`
argument through:

```typescript
const outerAction: Action<Input, Output> = async (client, input, options) => {
  // Forward options to inner action
  const result = await innerAction(client, transformedInput, options)
  return result
}
```

### MEDIUM: Bundling Actions in a class instead of exports

Individual `export const` declarations allow bundlers to tree-shake unused
Actions. Wrapping them in a class prevents dead-code elimination because the
class is a single unit.

```typescript
// WRONG: class prevents tree-shaking -- importing one Action pulls in all
export class BskyActions {
  static post: Action<PostInput, PostOutput> = async (client, input, options) => {
    // ...
  }
  static like: Action<LikeInput, LikeOutput> = async (client, input, options) => {
    // ...
  }
}

// CORRECT: individual exports are tree-shakeable
export const post: Action<PostInput, PostOutput> = async (
  client,
  input,
  options,
) => {
  // ...
}

export const like: Action<LikeInput, LikeOutput> = async (
  client,
  input,
  options,
) => {
  // ...
}
```

## Tension: Library Tree-Shaking vs. Developer Convenience

There is an inherent tension between **tree-shaking** and **API ergonomics**:

- **Individual exports** (`export const post`, `export const like`) allow
  bundlers to eliminate unused Actions, keeping bundle sizes small. This is
  the recommended pattern for libraries.

- **Grouped objects or classes** (`export class BskyActions { ... }`) provide
  discoverability and a single import path, but force bundlers to include
  every Action in the group even if only one is used.

**Guideline:** Use individual named exports for Actions. Consumers who want
grouping can re-export them under a namespace in their own code. Library
authors should use `lex build --pure-annotations` for generated schemas to
maximize tree-shakeability alongside their Actions.

## See Also

- [client-api](../client-api/SKILL.md) -- `Client` class, `client.call()`,
  `client.create()`, `client.xrpc()`, `CallOptions`, authentication.
- [data-validation](../data-validation/SKILL.md) -- `$build`, `$validate`,
  `$parse`, `$safeParse` for constructing and validating record data.
- [xrpc-requests](../xrpc-requests/SKILL.md) -- low-level `xrpc()` function,
  `XrpcResponseError`, error handling patterns.
