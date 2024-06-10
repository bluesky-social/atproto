# @atproto/oauth-client: atproto flavoured OAuth client

Core library for implementing ATPROTO OAuth clients.

For a browser specific implementation, see `@atproto/oauth-client-browser`.
For a node specific implementation, see `@atproto/oauth-client-node`.

```ts
import { OAuthClient } from '@atproto/oauth-client'
import { JoseKey } from '@atproto/jwk-jose' // NodeJS/Browser only

const client = new OAuthClient({
  handleResolver: 'https://bsky.social', // On node, you should use a DNS based resolver
  responseMode: 'query', // or "fragment" or "form_post" (for backend clients only)
  clientMetadata: {
    // These must be the same metadata as the one exposed on the
    // "/.well-known/oauth-client-metadata" endpoint (except when using a
    // loopback client)
  },

  runtimeImplementation: {
    // A runtime specific implementation of the crypto operations needed by the
    // OAuth client.

    createKey(algs: string[]): Promise<Key> {
      // algs is an ordered array of preferred algorithms (e.g. ['RS256', 'ES256'])

      // Note, in browser environments, it is better to use non extractable keys
      // to prevent leaking the private key. This can be done using the
      // WebcryptoKey class from the "@atproto/jwk-webcrypto" package. The
      // inconvenient of these keys (which is also what makes them stronger) is
      // that the only way to persist them across browser reloads is to save
      // them in the indexed DB.
      return JoseKey.generate(algs)
    },
    getRandomValues(length: number): Uint8Array | PromiseLike<Uint8Array> {
      // length is the number of bytes to generate

      const bytes = new Uint8Array(byteLength)
      crypto.getRandomValues(bytes)
      return bytes
    },
    digest(
      bytes: Uint8Array,
      algorithm: { name: 'sha256' | 'sha384' | 'sha512' },
    ): Uint8Array | PromiseLike<Uint8Array> {
      // sha256 is required. Unsupported algorithms should throw an error.

      const buffer = await this.crypto.subtle.digest(
        algorithm.name.startsWith('sha')
          ? `SHA-${algorithm.name.slice(-3)}`
          : 'invalid',
        bytes,
      )
      return new Uint8Array(buffer)
    },
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
    // "jwks_uri" of the client metadata.
    await JoseKey.fromImportable(process.env.PRIVATE_KEY_1),
    await JoseKey.fromImportable(process.env.PRIVATE_KEY_2),
    await JoseKey.fromImportable(process.env.PRIVATE_KEY_3),
  ],
})
```

```ts
const url = await client.authorize('foo.bsky.team', {
  state: '434321',
  prompt: 'consent',
  scope: 'email',
  ui_locales: 'fr',
})

// Make user visit "url". Then, once it was redirected to the callback URI, call:

const params = new URLSearchParams('code=...&state=...')
const result = await client.callback(params)

// Verify the state (e.g. to link to an internal user)
result.state === '434321'

// The authenticated user's identifier
result.agent.sub

// Make an authenticated request to the server. New credentials will be
// automatically fetched if needed (causing sessionStore.set() to be called).
await result.agent.request('/xrpc/foo.bar')

// revoke credentials on the server (causing sessionStore.del() to be called)
await result.agent.signOut()
```
