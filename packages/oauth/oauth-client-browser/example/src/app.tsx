import { BskyAgent } from '@atproto/api'
import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import { useCallback, useMemo, useState } from 'react'

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

  const bskyAgent = useMemo(
    () => (agent ? new BskyAgent(agent) : null),
    [agent],
  )

  const loadProfile = useCallback(async () => {
    if (!agent) return

    const info = await agent.getInfo()
    console.log('info', info)

    if (!bskyAgent) return

    // A call that requires to be authenticated
    console.log(
      await bskyAgent.com.atproto.server.getServiceAuth({
        aud: agent.sub,
      }),
    )

    // This call does not require authentication
    const profile = await bskyAgent.com.atproto.repo.getRecord({
      repo: agent.sub,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
    })

    console.log(profile)

    setProfile(profile.data)
  }, [agent, bskyAgent])

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
