import { useCallback, useState } from 'react'
import { useAuthContext } from './auth/auth-provider'

function App() {
  const { pdsAgent, signOut } = useAuthContext()

  // A call that requires to be authenticated
  const [serviceAuth, setServiceAuth] = useState<unknown>(undefined)
  const loadServiceAuth = useCallback(async () => {
    const serviceAuth = await pdsAgent.com.atproto.server.getServiceAuth({
      aud: pdsAgent.accountDid,
    })
    console.log('serviceAuth', serviceAuth)
    setServiceAuth(serviceAuth.data)
  }, [pdsAgent])

  // This call does not require authentication
  const [profile, setProfile] = useState<unknown>(undefined)
  const loadProfile = useCallback(async () => {
    const profile = await pdsAgent.com.atproto.repo.getRecord({
      repo: pdsAgent.accountDid,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
    })
    console.log(profile)
    setProfile(profile.data)
  }, [pdsAgent])

  return (
    <div>
      <p>Logged in!</p>

      <button onClick={loadProfile}>Load profile</button>
      <code>
        <pre>
          {profile !== undefined ? JSON.stringify(profile, undefined, 2) : null}
        </pre>
      </code>

      <button onClick={loadServiceAuth}>Load service auth</button>
      <code>
        <pre>
          {serviceAuth !== undefined
            ? JSON.stringify(serviceAuth, undefined, 2)
            : null}
        </pre>
      </code>

      <button onClick={signOut}>Sign-out</button>
    </div>
  )
}

export default App
