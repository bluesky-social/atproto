import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import { useCallback, useState } from 'react'

import LoginForm from './login-form'
import { useOAuth } from './oauth'

const client = new BrowserOAuthClient({
  plcDirectoryUrl: 'http://localhost:2582', // dev-env
  handleResolver: 'http://localhost:2584', // dev-env
})

function App() {
  const { agent, signedIn, signOut, loading, signIn } = useOAuth(client)
  const [profile, setProfile] = useState<{
    value: { displayName?: string }
  } | null>(null)

  const loadProfile = useCallback(async () => {
    if (!agent) return

    const info = await agent.getInfo()
    console.log('info', info)

    // A call that requires to be authenticated
    console.log(
      await agent
        .request(
          '/xrpc/com.atproto.server.getServiceAuth?' +
            new URLSearchParams({ aud: info.sub }).toString(),
        )
        .then((r) => r.json()),
    )

    // This call does not require authentication
    const profile = await agent
      .request(
        '/xrpc/com.atproto.repo.getRecord?' +
          new URLSearchParams({
            repo: info.sub,
            collection: 'app.bsky.actor.profile',
            rkey: 'self',
          }).toString(),
      )
      .then((r) => r.json())
    console.log(profile)

    setProfile(profile.data)
  }, [agent])

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
    <LoginForm loading={loading} onLogin={signIn} />
  )
}

export default App
