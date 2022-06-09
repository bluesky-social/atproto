import { useEffect, useState } from 'react'
// import * as authStore from './auth-store'
import * as auth from '@adxp/auth'

const SCOPE = auth.writeCap(
  'did:key:z6MkfRiFMLzCxxnw6VMrHK8pPFt4QAHS3jX3XM87y9rta6kP',
  'did:example:microblog',
)

const AUTH_LOBBY = 'http://localhost:3001'

function App() {
  const [authorized, setAuthorized] = useState(false)
  const [authStore, setAuthStore] = useState<auth.AuthStore | null>(null)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    getAuthStore()
  }, [])

  useEffect(() => {
    checkAuthorized()
  }, [authStore])

  const getAuthStore = async () => {
    const browserStore = await auth.BrowserStore.load()
    setAuthStore(browserStore)
  }

  const checkAuthorized = async () => {
    if (!authStore) {
      setAuthorized(false)
      return
    }
    const isAuthorized = await authStore.hasUcan(SCOPE)
    setAuthorized(isAuthorized)
  }

  const redirectToAuthLobby = async () => {
    if (!authStore) {
      return
    }
    setError(false)

    try {
      const did = await authStore.getDid()
      const ucan = await auth.acquireAppUcan(AUTH_LOBBY, did, SCOPE)
      await authStore.addUcan(ucan)
      setAuthorized(true)
    } catch (err) {
      console.error(err)
      setError(true)
    }
  }

  const logout = async () => {
    if (authStore) {
      await authStore.reset()
    }
    checkAuthorized()
  }

  return (
    <div>
      <h1>Application</h1>
      {authorized && (
        <div>
          <p>Logged In!</p>
          <button onClick={logout}>Logout</button>
        </div>
      )}
      {error && <div>Oh no! Something went wrong. Try again?</div>}
      {!authorized && (
        <button onClick={redirectToAuthLobby}>Sign in with Bluesky</button>
      )}
    </div>
  )
}

export default App
