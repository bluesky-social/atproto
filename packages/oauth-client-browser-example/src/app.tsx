import { BrowserOAuthClientFactory } from '@atproto/oauth-client-browser'
import { oauthClientMetadataSchema } from '@atproto/oauth-client-metadata'
import { useCallback, useState } from 'react'

import LoginForm from './login-form'
import { useOAuth } from './oauth'

import metadata from './oauth-client-metadata.json'

export const oauthFactory = new BrowserOAuthClientFactory({
  clientMetadata: oauthClientMetadataSchema.parse(metadata),
  responseType: 'code id_token',
  responseMode: 'fragment',
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
  const oauth = useOAuth(oauthFactory)
  const [profile, setProfile] = useState<{
    value: { displayName?: string }
  } | null>(null)

  const { client } = oauth

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

  return oauth.signedIn ? (
    <div>
      <p>Logged in!</p>
      <button onClick={loadProfile}>Load profile</button>
      <code>
        <pre>{profile ? JSON.stringify(profile, undefined, 2) : null}</pre>
      </code>

      <button onClick={oauth.signOut}>Logout</button>
    </div>
  ) : (
    <LoginForm
      error={oauth.error}
      loading={oauth.loading}
      onLogin={(input) => void oauth.signIn(input)}
    />
  )
}

export default App
