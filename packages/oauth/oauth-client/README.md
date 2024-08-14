# @atproto/oauth-client: atproto flavoured OAuth client

Core library for implementing [ATPROTO] OAuth clients.

For a browser specific implementation, see [@atproto/oauth-client-browser](https://www.npmjs.com/package/@atproto/oauth-client-browser).
For a node specific implementation, see
[@atproto/oauth-client-node](https://www.npmjs.com/package/@atproto/oauth-client-node).

## Usage

### Configuration

```ts
import { OAuthClient } from '@atproto/oauth-client'
import { JoseKey } from '@atproto/jwk-jose' // NodeJS/Browser only

const client = new OAuthClient({
  handleResolver: 'https://my-backend.example', // backend instances should use a DNS based resolver
  responseMode: 'query', // or "fragment" (frontend only) or "form_post" (backend only)

  // These must be the same metadata as the one exposed on the
  // "client_id" endpoint (except when using a loopback client)
  clientMetadata: {
    client_id: 'https://my-app.example/atproto-oauth-client.json',
    jwks_uri: 'https://my-app.example/jwks.json',
  },

  runtimeImplementation: {
    // A runtime specific implementation of the crypto operations needed by the
    // OAuth client. See "@atproto/oauth-client-browser" for a browser specific
    // implementation. The following example is suitable for use in NodeJS.

    createKey(algs: string[]): Promise<Key> {
      // algs is an ordered array of preferred algorithms (e.g. ['RS256', 'ES256'])

      // Note, in browser environments, it is better to use non extractable keys
      // to prevent the private key from being stolen. This can be done using
      // the WebcryptoKey class from the "@atproto/jwk-webcrypto" package. The
      // inconvenient of these keys (which is also what makes them stronger) is
      // that the only way to persist them across browser reloads is to save
      // them in the indexed DB.
      return JoseKey.generate(algs)
    },

    getRandomValues(length: number): Uint8Array | PromiseLike<Uint8Array> {
      return crypto.getRandomValues(new Uint8Array(length))
    },

    digest(
      bytes: Uint8Array,
      algorithm: { name: string },
    ): Uint8Array | PromiseLike<Uint8Array> {
      // sha256 is required. Unsupported algorithms should throw an error.

      if (algorithm.name.startsWith('sha')) {
        const subtleAlgo = `SHA-${algorithm.name.slice(3)}`
        const buffer = await crypto.subtle.digest(subtleAlgo, bytes)
        return new Uint8Array(buffer)
      }

      throw new TypeError(`Unsupported algorithm: ${algorithm.name}`)
    },

    requestLock: <T>(name: string, fn: () => T | PromiseLike<T>): Promise T => {
      // This function is used to prevent concurrent refreshes of the same
      // credentials. It is important to ensure that only one refresh is done at
      // a time to prevent the sessions from being revoked.

      // The following example shows a simple in-memory lock. In a real
      // application, you should use a more robust solution (e.g. a system wide
      // lock manager). Note that not providing a lock will result in an
      // in-memory lock to be used (DO NOT copy-paste the following code).

      declare const locks: Map<string, Promise<void>>

      const current = locks.get(name) || Promise.resolve()
      const next = current.then(fn).catch(() => {}).finally(() => {
        if (locks.get(name) === next) locks.delete(name)
      })

      locks.set(name, next)
      return next
    }
  },

  stateStore: {
    // A store for saving state data while the user is being redirected to the
    // authorization server.

    set(key: string, internalState: InternalStateData): Promise<void> {
      throw new Error('Not implemented')
    },
    get(key: string): Promise<InternalStateData | undefined> {
      throw new Error('Not implemented')
    },
    del(key: string): Promise<void> {
      throw new Error('Not implemented')
    },
  },

  sessionStore: {
    // A store for saving session data.

    set(sub: string, session: Session): Promise<void> {
      throw new Error('Not implemented')
    },
    get(sub: string): Promise<Session | undefined> {
      throw new Error('Not implemented')
    },
    del(sub: string): Promise<void> {
      throw new Error('Not implemented')
    },
  },

  keyset: [
    // For backend clients only, a list of private keys to use for signing
    // credentials. These keys MUST correspond to the public keys exposed on the
    // "jwks_uri" of the client metadata. Note that the jwks JSON corresponding
    // to the following keys can be obtained using the `client.jwks` getter.
    await JoseKey.fromImportable(process.env.PRIVATE_KEY_1),
    await JoseKey.fromImportable(process.env.PRIVATE_KEY_2),
    await JoseKey.fromImportable(process.env.PRIVATE_KEY_3),
  ],
})
```

### Authentication

```ts
const url = await client.authorize('foo.bsky.team', {
  state: '434321',
  prompt: 'consent',
  scope: 'email',
  ui_locales: 'fr',
})
```

Make user visit `url`. Then, once it was redirected to the callback URI, perform the following:

```ts
// Parse the query params from the callback URI
const params = new URLSearchParams('code=...&state=...')

// Process the callback using the OAuth client
const result = await client.callback(params)

// Verify the state (e.g. to link to an internal user)
result.state === '434321' // true

const agent = result.agent

// Make an authenticated request to the server. New credentials will be
// automatically fetched if needed (causing sessionStore.set() to be called).
await agent.post({
  text: 'Hello, world!',
})

if (agent instanceof AtpAgent) {
  // revoke credentials on the server (causing sessionStore.del() to be called)
  await agent.logout()
}
```

## Advances use-cases

### Listening for session updates and deletion

The `OAuthClient` will emit events whenever a session is updated or deleted.

```ts
import {
  Session,
  TokenRefreshError,
  TokenRevokedError,
} from '@atproto/oauth-client'

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

### Force user to re-authenticate

```ts
const url = await client.authorize(handle, {
  prompt: 'login',
  state,
})
```

or

```ts
const url = await client.authorize(handle, {
  state,
  max_age: 600, // Require re-authentication after 10 minutes
})
```

### Silent Sign-In

Using silent sign-in requires to handle retries on the callback endpoint.

```ts
async function createLoginUrl(handle: string, state?: string): string {
  return client.authorize(handle, {
    state,
    // Use "prompt=none" to attempt silent sign-in
    prompt: 'none',
  })
}

async function handleCallback(params: URLSearchParams) {
  try {
    return await client.callback(params)
  } catch (err) {
    // Silent sign-in failed, retry without prompt=none
    if (
      err instanceof OAuthCallbackError &&
      ['login_required', 'consent_required'].includes(err.params.get('error'))
    ) {
      // Do *not* use prompt=none when retrying (to avoid infinite redirects)
      const url = await client.authorize(handle, { state: err.state })

      // Allow calling code to catch the error and redirect the user to the new URL
      return new MyLoginRequiredError(url)
    }

    throw err
  }
}
```

[ATPROTO]: https://atproto.com/ 'AT Protocol'
