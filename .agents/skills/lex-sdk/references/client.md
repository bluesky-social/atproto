# `Client` — high-level XRPC client

`Client` wraps an XRPC session with helpers for AT Proto repo operations
(`create`, `get`, `put`, `delete`, `list`, `applyWrites`, `uploadBlob`),
plus low-level `call`/`xrpc`/`xrpcSafe` methods. Use it whenever you have
an authenticated session, or you want to encapsulate per-service config
(headers, labelers, proxy target).

For unauthenticated stateless calls, see [xrpc.md](xrpc.md).

## Constructing

### Unauthenticated

```ts
import { Client } from '@atproto/lex'

const client = new Client('https://public.api.bsky.app')
```

### Authenticated — OAuth

```ts
import { OAuthClient } from '@atproto/oauth-client-node'

const session = await oauthClient.restore(userDid)
const client = new Client(session)
```

### Authenticated — password (CLI / scripts / bots)

```ts
import { PasswordSession } from '@atproto/lex-password-session'

const session = await PasswordSession.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'xxxx-xxxx-xxxx-xxxx',
  onUpdated: (data) => saveToStorage(data),
  onDeleted: (data) => clearStorage(data.did),
})
const client = new Client(session)
```

### Service proxy (auth required)

```ts
const client = new Client(session, {
  service: 'did:web:api.bsky.app#bsky_appview',
})
```

### One client, multiple services

`service` and `labelers` are _defaults_, overridable per request. `null`
disables the corresponding header for that request. This lets a single
AppView-configured client also reach the user's PDS directly. Record helpers
(`create`, `get`, `put`, `delete`, `list`, `*Record`, `applyWrites`,
`uploadBlob`, `getBlob`) always default to `service: null` /
`labelers: null` (PDS-targeted). Static `appLabelers` (via
`Client.configure()`) are always applied with `;redact` unless overridden
via the `appLabelers` option (`null` disables).

```ts
const client = new Client(session, {
  service: 'did:web:api.bsky.app#bsky_appview',
})

// Proxied to the AppView (client default)
await client.call(app.bsky.feed.getTimeline)

// Straight to the user's PDS (no atproto-proxy header)
await client.xrpc(com.atproto.repo.getRecord, {
  service: null,
  params: { repo: client.assertDid, collection, rkey: 'self' },
})
```

### Server-side service calls (no user session)

When wiring a service to call another service with a static API key, you
don't need a session — pass headers in the constructor:

```ts
const sc = config.serviceUrl
  ? new Client({
      service: config.serviceUrl,
      headers: config.serviceApiKey
        ? { authorization: `Bearer ${config.serviceApiKey}` }
        : undefined,
    })
  : undefined
```

## Validation options

```ts
const client = new Client(session, {
  validateRequest: false, // default
  validateResponse: true, // default
  strictResponseProcessing: true, // default
})
```

| Option                     | Default | Meaning                                                                                                                   |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `validateRequest`          | `false` | Validate request bodies against input schema before sending                                                               |
| `validateResponse`         | `true`  | Validate response bodies against output schema                                                                            |
| `strictResponseProcessing` | `true`  | Strict Lex decoding; set `false` to accept legacy blobs, datetimes without timezones, etc. (see [schemas.md](schemas.md)) |

All three can be overridden per-call via `client.call`/`xrpc`/`xrpcSafe`
options.

## Authentication accessors

```ts
client.did // Did | undefined
client.assertAuthenticated() // throws if not authed; narrows did to Did
client.assertDid // Did (throws if not authed)
```

## Core methods

### `client.call()` — call a method, return body

```ts
import { app } from './lexicons/index.js'

// Query (GET)
const profile = await client.call(app.bsky.actor.getProfile, {
  actor: 'pfrazee.com',
})

// Procedure (POST)
const result = await client.call(app.bsky.feed.sendInteractions, {
  interactions: [
    /* ... */
  ],
})

// With options
const timeline = await client.call(
  app.bsky.feed.getTimeline,
  { limit: 50 },
  {
    signal: abortSignal,
    headers: { 'custom-header': 'value' },
    strictResponseProcessing: false,
    validateResponse: false,
  },
)
```

`call` returns the body directly. Errors throw — wrap in try/catch or use
`xrpcSafe` for structured errors.

### `client.xrpc()` — full response (status, headers, body)

```ts
const response = await client.xrpc(app.bsky.feed.getTimeline, {
  params: { limit: 50 },
  signal: abortSignal,
  headers: { 'custom-header': 'value' },
  strictResponseProcessing: false,
  validateResponse: false,
})
response.status
response.headers.get('content-language')
response.body
```

### `client.xrpcSafe()` — discriminated result

Same as [xrpc.md](xrpc.md)'s `xrpcSafe()` but bound to the client's
session/config:

```ts
const result = await client.xrpcSafe(com.atproto.identity.resolveHandle, {
  params: { handle: 'alice.bsky.social' },
})
if (result.success) result.body
else result.error
```

### `client.create()` — create a record

```ts
import { currentDatetimeString } from '@atproto/lex'

const result = await client.create(app.bsky.feed.post, {
  text: 'Hello, world!',
  createdAt: currentDatetimeString(),
})
result.uri // at://did:plc:.../app.bsky.feed.post/...
result.cid
```

Options:

- `rkey` — custom record key (auto-generated otherwise)
- `validate` — ask the PDS to validate
- `validateRequest` — locally validate before sending
- `swapCommit` — optimistic concurrency (commit CID)

### `client.get()` — read a record

```ts
// Records with literal keys (e.g. profile uses rkey 'self')
const profile = await client.get(app.bsky.actor.profile)

// Records with non-literal keys
const post = await client.get(app.bsky.feed.post, { rkey: '3jxf7z2k3q2' })
```

### `client.put()` — update a record

```ts
await client.put(app.bsky.actor.profile, {
  displayName: 'New Name',
  description: 'Updated bio',
})
```

Options: `rkey`, `validate` / `validateRequest`, `swapCommit`,
`swapRecord` (optimistic concurrency on the existing record's CID).

### `client.delete()` — delete a record

```ts
await client.delete(app.bsky.feed.post, { rkey: '3jxf7z2k3q2' })
```

### `client.list()` — paginate a collection

```ts
const result = await client.list(app.bsky.feed.post, {
  limit: 50,
  reverse: true,
})
for (const r of result.records) console.log(r.uri, r.value.text)

if (result.cursor) {
  const next = await client.list(app.bsky.feed.post, {
    cursor: result.cursor,
    limit: 50,
  })
}
```

### `client.applyWrites()` — atomic batch writes

```ts
const response = await client.applyWrites((op) => [
  op.create(app.bsky.feed.post, {
    text: 'Hello!',
    createdAt: currentDatetimeString(),
  }),
  op.update(app.bsky.actor.profile, { displayName: 'Alice' }),
  op.delete(app.bsky.feed.post, { rkey: '3jxf7z2k3q2' }),
])
for (const r of response.body.results) console.log(r.uri, r.cid)
```

All ops succeed or fail together. Options: `repo` (defaults to
`client.did`), `validate`, `swapCommit`.

## Labelers

```ts
// App-wide defaults (process-global)
Client.configure({ appLabelers: ['did:plc:labeler1'] })

// Per-client
const client = new Client(session, { labelers: ['did:plc:labeler3'] })

client.addLabelers(['did:plc:labeler4'])
client.setLabelers(['did:plc:labeler5'])
client.clearLabelers()
```

A common flow: read user prefs after login, configure labelers from the
`labelersPref`:

```ts
const { preferences } = await client.call(app.bsky.actor.getPreferences)
const pref = preferences.findLast(app.bsky.actor.defs.labelersPref.$isTypeOf)
client.setLabelers(pref?.labelers.map((l) => l.did) ?? [])
```

## Actions — composable client operations

An `Action` is a function that receives a `Client`, an input, and call
options, and returns a result. It can be invoked via `client.call()`.

```ts
import { Action, Client } from '@atproto/lex'
import { app } from './lexicons/index.js'

type LikeInput = { uri: string; cid: string }
type LikeOutput = { uri: string; cid: string }

export const likePost: Action<LikeInput, LikeOutput> = async (
  client,
  { uri, cid },
  options,
) => {
  client.assertAuthenticated()
  return client.create(
    app.bsky.feed.like,
    { subject: { uri, cid }, createdAt: currentDatetimeString() },
    options,
  )
}

// Use it
await client.call(likePost, { uri, cid })
```

Actions compose:

```ts
const upsertPreference: Action<Preference, Preference[]> = async (
  client,
  pref,
  options,
) => {
  const { preferences } = await client.call(
    app.bsky.actor.getPreferences,
    options,
  )
  const updated = [...preferences.filter((p) => p.$type !== pref.$type), pref]
  await client.call(
    app.bsky.actor.putPreferences,
    { preferences: updated },
    options,
  )
  return updated
}
```

Build a library by exporting actions individually (good for tree-shaking):

```ts
// actions.ts
export const post: Action</* ... */> = async (c, i, o) => {
  /* ... */
}
export const follow: Action</* ... */> = async (c, i, o) => {
  /* ... */
}

// usage
import * as actions from './actions.js'
await client.call(actions.post, { text: 'Hello!' })
```

Action best practices:

1. Always type as `Action<Input, Output>`.
2. Call `client.assertAuthenticated()` if auth is required.
3. Check `options.signal?.throwIfAborted()` between long operations.
4. Implement retry loops for swap-error / optimistic-concurrency cases.
5. Export actions individually so consumers can tree-shake.
