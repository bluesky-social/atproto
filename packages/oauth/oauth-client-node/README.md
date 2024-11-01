# atproto OAuth Client for NodeJS

This package implements all the OAuth features required by [ATPROTO] (PKCE,
etc.) to run in a NodeJS based environment such as desktop apps built with
Electron or traditional web app backends built with frameworks like Express.

## Setup

### Client configuration

The `client_id` is what identifies your application to the OAuth server. It is
used to fetch the client metadata, and to initiate the OAuth flow. The
`client_id` must be a URL that points to the client metadata.

Your OAuth client metadata should be hosted at a URL that corresponds to the
`client_id` of your application. This URL should return a JSON object with the
client metadata. The client metadata should be configured according to the
needs of your application, and must respect the [ATPROTO].

#### From a backend service

The `client_metadata` object will typically be built by the backend at startup.

```ts
import { NodeOAuthClient, Session } from '@atproto/oauth-client-node'
import { JoseKey } from '@atproto/jwk-jose'

const client = new NodeOAuthClient({
  // This object will be used to build the payload of the /client-metadata.json
  // endpoint metadata, exposing the client metadata to the OAuth server.
  clientMetadata: {
    // Must be a URL that will be exposing this metadata
    client_id: 'https://my-app.com/client-metadata.json',
    client_name: 'My App',
    client_uri: 'https://my-app.com',
    logo_uri: 'https://my-app.com/logo.png',
    tos_uri: 'https://my-app.com/tos',
    policy_uri: 'https://my-app.com/policy',
    redirect_uris: ['https://my-app.com/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    dpop_bound_access_tokens: true,
    jwks_uri: 'https://my-app.com/jwks.json',
  },

  // Used to authenticate the client to the token endpoint. Will be used to
  // build the jwks object to be exposed on the "jwks_uri" endpoint.
  keyset: await Promise.all([
    JoseKey.fromImportable(process.env.PRIVATE_KEY_1),
    JoseKey.fromImportable(process.env.PRIVATE_KEY_2),
    JoseKey.fromImportable(process.env.PRIVATE_KEY_3),
  ]),

  // Interface to store authorization state data (during authorization flows)
  stateStore: {
    async set(key: string, internalState: NodeSavedState): Promise<void> {},
    async get(key: string): Promise<NodeSavedState | undefined> {},
    async del(key: string): Promise<void> {},
  },

  // Interface to store authenticated session data
  sessionStore: {
    async set(sub: string, session: Session): Promise<void> {},
    async get(sub: string): Promise<Session | undefined> {},
    async del(sub: string): Promise<void> {},
  },

  // A lock to prevent concurrent access to the session store. Optional if only one instance is running.
  requestLock,
})

const app = express()

// Expose the metadata and jwks
app.get('client-metadata.json', (req, res) => res.json(client.clientMetadata))
app.get('jwks.json', (req, res) => res.json(client.jwks))

// Create an endpoint to initiate the OAuth flow
app.get('/login', async (req, res, next) => {
  try {
    const handle = 'some-handle.bsky.social' // eg. from query string
    const state = '434321'

    // Revoke any pending authentication requests if the connection is closed (optional)
    const ac = new AbortController()
    req.on('close', () => ac.abort())

    const url = await client.authorize(handle, {
      signal: ac.signal,
      state,
      // Only supported if OAuth server is openid-compliant
      ui_locales: 'fr-CA fr en',
    })

    res.redirect(url)
  } catch (err) {
    next(err)
  }
})

// Create an endpoint to handle the OAuth callback
app.get('/atproto-oauth-callback', async (req, res, next) => {
  try {
    const params = new URLSearchParams(req.url.split('?')[1])

    const { session, state } = await client.callback(params)

    // Process successful authentication here
    console.log('authorize() was called with state:', state)

    console.log('User authenticated as:', session.did)

    const agent = new Agent(session)

    // Make Authenticated API calls
    const profile = await agent.getProfile({ actor: agent.did })
    console.log('Bsky profile:', profile.data)

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Whenever needed, restore a user's session
async function worker() {
  const userDid = 'did:plc:123'

  const oauthSession = await client.restore(userDid)

  // Note: If the current access_token is expired, the session will automatically
  // (and transparently) refresh it. The new token set will be saved though
  // the client's session store.

  const agent = new Agent(oauthSession)

  // Make Authenticated API calls
  const profile = await agent.getProfile({ actor: agent.did })
  console.log('Bsky profile:', profile.data)
}
```

#### From a native application

This applies to mobile apps, desktop apps, etc. based on NodeJS (e.g. Electron).

The client metadata must be hosted on an internet-accessible URL owned by you.
The client metadata will typically contain:

```json
{
  "client_id": "https://my-app.com/client-metadata.json",
  "client_name": "My App",
  "client_uri": "https://my-app.com",
  "logo_uri": "https://my-app.com/logo.png",
  "tos_uri": "https://my-app.com/tos",
  "policy_uri": "https://my-app.com/policy",
  "redirect_uris": ["https://my-app.com/atproto-oauth-callback"],
  "scope": "atproto",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "application_type": "native",
  "token_endpoint_auth_method": "none",
  "dpop_bound_access_tokens": true
}
```

Instead of hard-coding the client metadata in your app, you can fetch it when
the app starts:

```ts
import { NodeOAuthClient } from '@atproto/oauth-client-node'

const client = await NodeOAuthClient.fromClientId({
  clientId: 'https://my-app.com/client-metadata.json',

  stateStore: {
    async set(key: string, internalState: NodeSavedState): Promise<void> {},
    async get(key: string): Promise<NodeSavedState | undefined> {},
    async del(key: string): Promise<void> {},
  },

  sessionStore: {
    async set(sub: string, session: Session): Promise<void> {},
    async get(sub: string): Promise<Session | undefined> {},
    async del(sub: string): Promise<void> {},
  },

  // A lock to prevent concurrent access to the session store. Optional if only one instance is running.
  requestLock,
})
```

> [!NOTE]
>
> There is no `keyset` in this instance. This is due to the fact that app
> clients cannot safely store a private key. The `token_endpoint_auth_method` is
> set to `none` in the client metadata, which means that the client will not be
> authenticating itself to the token endpoint. This will cause sessions to have
> a shorter lifetime. You can circumvent this by providing a "BFF" (Backend for
> Frontend) that will perform an authenticated OAuth flow and use a session id
> based mechanism to authenticate the client.

### Common configuration options

The `OAuthClient` and `OAuthAgent` classes will manage and refresh OAuth tokens
transparently. They are also responsible to properly format the HTTP requests
payload, using DPoP, and transparently retrying requests when the access token
expires.

For this to work, the client must be configured with the following options:

#### `sessionStore`

A simple key-value store to save the OAuth session data. This is used to save
the access token, refresh token, and other session data.

```ts
const sessionStore: NodeSavedSessionStore = {
  async set(sub: string, sessionData: NodeSavedSession) {
    // Insert or update the session data in your database
    await saveSessionDataToDb(sub, sessionData)
  },

  async get(sub: string) {
    // Retrieve the session data from your database
    const sessionData = await getSessionDataFromDb(sub)
    if (!sessionData) return undefined

    return sessionData
  },

  async del(sub: string) {
    // Delete the session data from your database
    await deleteSessionDataFromDb(sub)
  },
}
```

#### `stateStore`

A simple key-value store to save the state of the OAuth
authorization flow. This is used to prevent CSRF attacks.

The implementation of the `StateStore` is similar to the
[`sessionStore`](#sessionstore).

```ts
interface NodeSavedStateStore {
  set: (key: string, internalState: NodeSavedState) => Promise<void>
  get: (key: string) => Promise<NodeSavedState | undefined>
  del: (key: string) => Promise<void>
}
```

One notable exception is that state store items can (and should) be deleted
after a short period of time (one hour should be more than enough).

#### `requestLock`

When multiple instances of the client are running, this lock will prevent
concurrent refreshes of the same session.

Here is an example implementation based on [`redlock`](https://www.npmjs.com/package/redlock):

```ts
import { RuntimeLock } from '@atproto/oauth-client-node'
import Redis from 'ioredis'
import Redlock from 'redlock'

const redisClients = new Redis()
const redlock = new Redlock(redisClients)

const requestLock: RuntimeLock = async (key, fn) => {
  // 30 seconds should be enough. Since we will be using one lock per user id
  // we can be quite liberal with the lock duration here.
  const lock = await redlock.lock(key, 45e3)
  try {
    return await fn()
  } finally {
    await redlock.unlock(lock)
  }
}
```

## Usage with `@atproto/api`

`@atproto/oauth-client-*` packages all return an `ApiClient` instance upon
successful authentication. This instance can be used to make authenticated
requests using all the `ApiClient` methods defined in [[API]] (non exhaustive
list of examples below). Any refresh of the credentials will happen under the
hood, and the new tokens will be saved in the session store.

```ts
const session = await client.restore('did:plc:123')
const agent = new Agent(session)

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

// etc.

// Always remember to revoke the credentials when you are done
await session.signOut()
```

## Advances use-cases

### Listening for session updates and deletion

The `OAuthClient` will emit events whenever a session is updated or deleted.

```ts
import {
  Session,
  TokenRefreshError,
  TokenRevokedError,
} from '@atproto/oauth-client-node'

client.addEventListener('updated', (event: CustomEvent<Session>) => {
  console.log('Refreshed tokens were saved in the store:', event.detail)
})

client.addEventListener(
  'deleted',
  (
    event: CustomEvent<{
      sub: string
      cause: TokenRefreshError | TokenRevokedError | unknown
    }>,
  ) => {
    console.log('Session was deleted from the session store:', event.detail)

    const { cause } = event.detail

    if (cause instanceof TokenRefreshError) {
      // - refresh_token unavailable or expired
      // - oauth response error (`cause.cause instanceof OAuthResponseError`)
      // - session data does not match expected values returned by the OAuth server
    } else if (cause instanceof TokenRevokedError) {
      // Session was revoked through:
      // - session.signOut()
      // - client.revoke(sub)
    } else {
      // An unexpected error occurred, causing the session to be deleted
    }
  },
)
```

### Silent Sign-In

Using silent sign-in requires to handle retries on the callback endpoint.

```ts
app.get('/login', async (req, res) => {
  const handle = 'some-handle.bsky.social' // eg. from query string
  const user = req.user.id

  const url = await client.authorize(handle, {
    // Use "prompt=none" to attempt silent sign-in
    prompt: 'none',

    // Build an internal state to map the login request to the user, and allow retries
    state: JSON.stringify({
      user,
      handle,
    }),
  })

  res.redirect(url)
})

app.get('/atproto-oauth-callback', async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1])
  try {
    try {
      const { session, state } = await client.callback(params)

      // Process successful authentication here. For example:

      const agent = new Agent(session)

      const profile = await agent.getProfile({ actor: agent.did })

      console.log('Bsky profile:', profile.data)
    } catch (err) {
      // Silent sign-in failed, retry without prompt=none
      if (
        err instanceof OAuthCallbackError &&
        ['login_required', 'consent_required'].includes(err.params.get('error'))
      ) {
        // Parse previous state
        const { user, handle } = JSON.parse(err.state)

        const url = await client.authorize(handle, {
          // Note that we omit the prompt parameter here. Setting "prompt=none"
          // here would result in an infinite redirect loop.

          // Build a new state (or re-use the previous one)
          state: JSON.stringify({
            user,
            handle,
          }),
        })

        // redirect to new URL
        res.redirect(url)

        return
      }

      throw err
    }
  } catch (err) {
    next(err)
  }
})
```

[ATPROTO]: https://atproto.com/ 'AT Protocol'
[API]: ../../api/README.md
