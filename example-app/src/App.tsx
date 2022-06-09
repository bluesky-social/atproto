import { useEffect, useState } from 'react'
import * as authStore from './auth-store'

const SCOPE =
  'did:key:z6MkfRiFMLzCxxnw6VMrHK8pPFt4QAHS3jX3XM87y9rta6kP|did:example:microblog|*'

function App() {
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    checkAuthorized()
  }, [])

  const checkAuthorized = async () => {
    const isAuthorized = await authStore.hasValidUcanInStore(SCOPE)
    setAuthorized(isAuthorized)
  }

  const redirectToAuthLobby = async () => {
    await authStore.acquireUcan(SCOPE)
    setAuthorized(true)
  }

  const logout = () => {
    authStore.clear()
    setAuthorized(false)
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
      {!authorized && (
        <button onClick={redirectToAuthLobby}>Sign in with Bluesky</button>
      )}
    </div>
  )
}

export default App
