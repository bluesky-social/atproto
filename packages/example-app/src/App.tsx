import React, { useEffect, useState } from 'react'
import * as auth from '@adxp/auth'
import * as env from './env'

const SCOPE = auth.writeCap(
  'did:key:z6MkfRiFMLzCxxnw6VMrHK8pPFt4QAHS3jX3XM87y9rta6kP',
  'did:example:microblog',
)

interface Props {}

const App: React.FC<Props> = () => {
  const [authorized, setAuthorized] = useState(false)
  const [authStore, setAuthStore] = useState<auth.AuthStore | null>(null)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    getAuthStore()
  }, [])

  useEffect(() => {
    checkAuthorized()
    checkHashFragment()
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

  const checkHashFragment = async () => {
    if (!authStore) return
    const fragment = window.location.hash
    if (fragment.length < 1) return
    try {
      const ucan = await auth.parseLobbyResponseHashFragment(fragment)
      await authStore.addUcan(ucan)
      setAuthorized(true)
      window.location.hash = ''
    } catch (err) {
      console.error(err)
      setError(true)
    }
  }

  const requestAppUcan = async () => {
    if (!authStore) return

    // REDIRECT FLOW
    const did = await authStore.did()
    const redirectTo = window.location.origin
    const fragment = auth.requestAppUcanHashFragment(did, SCOPE, redirectTo)
    window.location.href = `${env.AUTH_LOBBY}#${fragment}`

    // POST MESSAGE FLOW
    // setError(false)
    // try {
    //   const did = await authStore.getDid()
    //   const ucan = await auth.requestAppUcan(env.AUTH_LOBBY, did, SCOPE)
    //   await authStore.addUcan(ucan)
    //   setAuthorized(true)
    // } catch (err) {
    //   console.error(err)
    //   setError(true)
    // }
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
        <button onClick={requestAppUcan}>Sign in with Bluesky</button>
      )}
    </div>
  )
}

export default App
