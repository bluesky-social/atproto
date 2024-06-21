# ATPROTO OAuth Client for NodeJS

This package implements all the OAuth features required by [ATPROTO] (PKCE,
etc.) to run in a NodeJS based environment.

## Setup

### Client ID

The `client_id` is what identifies your application to the OAuth server. It is
used to fetch the client metadata, and to initiate the OAuth flow. The
`client_id` must be a URL that points to the [client
metadata](#client-metadata).

### Client Metadata

Your OAuth client metadata should be hosted at a URL that corresponds to the
`client_id` of your application. This URL should return a JSON object with the
client metadata. The client metadata should be configured according to the
needs of your application, and must respect the [ATPROTO].

### Usage

#### From a backend service

The `client_metadata` object will typically be build by the backend at startup.

```ts
import { NodeOAuthClientOptions } from '@atproto/oauth-client-node'

const client = new NodeOAuthClientOptions({
  clientMetadata: (clientMetadata = {
    // Must be a URL that will be exposing this metadata
    client_id: 'https://my-app.com/client-metadata.json',
    client_name: 'My App',
    client_uri: 'https://my-app.com',
    logo_uri: 'https://my-app.com/logo.png',
    tos_uri: 'https://my-app.com/tos',
    policy_uri: 'https://my-app.com/policy',
    redirect_uris: ['https://my-app.com/callback'],
    scope: 'profile email offline_access',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    application_type: 'web',
    token_endpoint_auth_method: 'client_secret_jwt',
    dpop_bound_access_tokens: true,
    jwks_uri: 'https://my-app.com/jwks.json',
  }),

  // Used to authenticate the client to the token endpoint. Will be used to
  // build the jwks object to be exposed on the "jwks_uri" endpoint.
  keyset: await Promise.all([
    JoseKey.fromImportable(process.env.PRIVATE_KEY_1),
    JoseKey.fromImportable(process.env.PRIVATE_KEY_2),
    JoseKey.fromImportable(process.env.PRIVATE_KEY_3),
  ]),

  stateStore: {
    set(key: string, internalState: InternalStateData): Promise<void> {},
    get(key: string): Promise<InternalStateData | undefined> {},
    del(key: string): Promise<void> {},
  },

  sessionStore: {
    set(sub: string, session: Session): Promise<void> {},
    get(sub: string): Promise<Session | undefined> {},
    del(sub: string): Promise<void> {},
  },

  // A lock to prevent concurrent access to the session store. Optional if only one instance is running.
  requestLock,
})

const app = express()

app.get('client-metadata.json', (req, res) => res.json(client.clientMetadata))
app.get('jwks.json', (req, res) => res.json(client.jwks))

app.get('/login', async (req, res, next) => {
  try {
    const handle = 'some-handle.bsky.social' // eg. from query string
    const state = '434321'

    const ac = new AbortController()
    req.on('close', () => ac.abort())

    const url = await client.authorize(handle, {
      state,
      // Revoke any pending authentication request if the user closes the connection
      signal: ac.signal,
      // Only supported if OAuth server is openid-compliant
      ui_locales: 'fr-CA fr en',
    })

    res.redirect(url)
  } catch (err) {
    next(err)
  }
})

app.get('/callback', async (req, res, next) => {
  try {
    const params = new URLSearchParams(req.url.split('?')[1])

    const { agent, state } = await client.callback(params)

    console.log('User authenticated as:', agent.sub)

    const info = await agent.getInfo()
    console.log('User info:', info)

    console.log('Authentication was initiated with state:', state)

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

async function worker() {
  const sub = 'did:plc:123'

  const agent = await client.restore(sub)

  // Note: If the current access_token is expired, the agent will automatically
  // (and transparently) refresh it. The new token set will be saved though
  // the client's session store.

  const info = await agent.getInfo()
  console.log('User info:', info)
}
```

#### From a native application

This applies to mobile apps, desktop apps, etc. based on NodeJS (e.g. Electron).

The client metadata must be hosted on an internet-accessible URL owned by you.
The client metadata will typically contain:

```json
{
  // Must be the same URL as the one used to obtain this JSON object
  "client_id": "https://my-app.com/client-metadata.json",
  "client_name": "My App",
  "client_uri": "https://my-app.com",
  "logo_uri": "https://my-app.com/logo.png",
  "tos_uri": "https://my-app.com/tos",
  "policy_uri": "https://my-app.com/policy",
  "redirect_uris": ["https://my-app.com/callback"],
  "scope": "profile email offline_access",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "application_type": "native",
  "token_endpoint_auth_method": "none",
  "dpop_bound_access_tokens": true
}
```

You can then load the client metadata asynchronously when you app is starting up.

```ts
import { NodeOAuthClientOptions } from '@atproto/oauth-client-node'

const client = await NodeOAuthClientOptions.fromClientId({
  clientId: 'https://my-app.com/client-metadata.json',

  stateStore: {
    set(key: string, internalState: InternalStateData): Promise<void> {},
    get(key: string): Promise<InternalStateData | undefined> {},
    del(key: string): Promise<void> {},
  },

  sessionStore: {
    set(sub: string, session: Session): Promise<void> {},
    get(sub: string): Promise<Session | undefined> {},
    del(sub: string): Promise<void> {},
  },

  // A lock to prevent concurrent access to the session store. Optional if only one instance is running.
  requestLock,
})
```

### Configuration

- `stateStore`
- `sessionStore`
- `requestLock`

## Usage with `@atproto/api`

The `@atproto/api` package provides a way to interact with the com.atproto and
app.bsky XRPC lexicons. The `OAuthAgent` can be used directly as session
manager for `AtpAgent` and `BskyAgent`.

```ts
import { AtpAgent, BskyAgent } from '@atproto/api'

const atpAgent = new AtpAgent(oauthAgent)
const bskyAgent = new BskyAgent(oauthAgent)
```

Any refresh of the credentials will happen under the hood, and the new tokens
will be saved in the session store.

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
      // - agent.signOut()
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
    state: JSON.stringify({
      user,
      handle,
    }),

    // Use "prompt=none" to attempt silent sign-in
    prompt: 'none',
  })

  res.redirect(url)
})

app.get('/callback', async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1])
  try {
    try {
      const { agent, state } = await client.callback(params)

      // Process successful authentication here
    } catch (err) {
      // Silent sign-in failed, retry without prompt=none
      if (
        err instanceof OAuthCallbackError &&
        ['login_required', 'consent_required'].includes(err.params.get('error'))
      ) {
        // Parse previous state
        const { user, handle } = JSON.parse(err.state)

        const url = await client.authorize(handle, {
          // build new state
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
