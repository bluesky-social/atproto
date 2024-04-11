import { BrowserOAuthClientFactory } from '@atproto/oauth-client-browser'
import { oauthClientMetadataSchema } from '@atproto/oauth-client-metadata'
import { useCallback, useState } from 'react'

import LoginForm from './login-form'
import { useOAuth } from './oauth'

export const oauthFactory = new BrowserOAuthClientFactory({
  clientMetadata: oauthClientMetadataSchema.parse({
    client_id: 'http://localhost/',
    redirect_uris: ['http://127.0.0.1:5173/'],
    response_types: ['code id_token', 'code'],
  }),
  responseMode: 'fragment',
  plcDirectoryUrl: 'http://localhost:2582', // dev-env
  atprotoLexiconUrl: 'http://localhost:2584', // dev-env (bsky appview)
})

/**
 * State data that we want to persist across the OAuth flow, when the user is
 * "logging in".
 */
export type AppState = {
  foo: string
}

/**
 * The {@link OAuthFrontendXrpcAgent} provides the hostname of the PDS, as
 * defined during the authentication flow and credentials (`Authorization` +
 * `DPoP`) form the XRPC calls. It will also handle transparently refreshing
 * the credentials when they expire.
 */

function App() {
  const { initialized, client, signedIn, signOut, error, loading, signIn } =
    useOAuth(oauthFactory)
  const [profile, setProfile] = useState<{
    value: { displayName?: string }
  } | null>(null)

  const loadProfile = useCallback(async () => {
    if (!client) return

    const info = await client.getUserinfo()
    console.log('info', info)

    const get = async (method: string, params: Record<string, string>) => {
      const response = await client.request(
        `/xrpc/${method}?${new URLSearchParams(params).toString()}`,
      )
      return response.json()
    }

    // A call that requires to be authenticated
    console.log(
      await get('com.atproto.server.getServiceAuth', { aud: info.sub }),
    )

    // This call does not require authentication
    const profile = await get('com.atproto.repo.getRecord', {
      repo: info.sub,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
    })

    setProfile(profile)

    console.log(profile)
  }, [client])

  if (!initialized) {
    return <p>{error || 'Loading...'}</p>
  }

  return signedIn ? (
    <div>
      <p>Logged in!</p>
      <button onClick={loadProfile}>Load profile</button>
      <code>
        <pre>{profile ? JSON.stringify(profile, undefined, 2) : null}</pre>
      </code>

      <button onClick={signOut}>Logout</button>
    </div>
  ) : (
    <LoginForm
      error={error}
      loading={loading}
      onLogin={(input) => void signIn(input)}
    />
  )
}

export default App
