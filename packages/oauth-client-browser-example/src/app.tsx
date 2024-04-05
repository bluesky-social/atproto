import { BrowserOAuthClientFactory } from '@atproto/oauth-client-browser'
import { oauthClientMetadataSchema } from '@atproto/oauth-client-metadata'
import { useCallback, useRef } from 'react'

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
  const fileInput = useRef<HTMLInputElement>(null)

  const { client } = oauth

  const sendPost = useCallback(async () => {
    if (!client) return

    const info = await client.getUserinfo()
    console.log('info', info)

    const get = async (method: string, params: Record<string, string>) => {
      const response = await client.request(
        `/xrpc/${method}?${new URLSearchParams(params).toString()}`,
      )
      return response.json()
    }

    console.log(
      'getProfile',
      await get('com.atproto.repo.getRecord', {
        repo: info.sub,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      }),
    )

    console.log(
      'getServiceAuth',
      await get('com.atproto.server.getServiceAuth', {
        aud: info.sub,
      }),
    )
  }, [client])

  return oauth.signedIn ? (
    <div>
      <p>Logged in!</p>
      <input type="file" ref={fileInput} />
      <button onClick={sendPost}>Send Post</button>
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
