import { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'

import Lobby from './Lobby'
import LoginPage from './LoginPage'
import * as env from './env'

function App() {
  const [authorized, setAuthorized] = useState(false)
  const [authStore, setAuthStore] = useState<auth.AuthStore | null>(null)

  useEffect(() => {
    getAuthStore()
  }, [])

  useEffect(() => {
    checkAuthorized()
  }, [authStore])

  const getAuthStore = async () => {
    const browserStore =
      env.PRIV_KEY !== null
        ? await auth.BrowserStore.loadRootAuth(env.PRIV_KEY)
        : await auth.BrowserStore.load()
    setAuthStore(browserStore)
  }

  const checkAuthorized = async () => {
    if (!authStore) {
      setAuthorized(false)
      return
    }
    const isAuthorized = await authStore.hasUcan(auth.writeCap(env.ROOT_USER))
    setAuthorized(isAuthorized)
  }

  return (
    <div>
      <h1>Auth Lobby</h1>
      {!authStore && <div>Loading...</div>}
      {authStore && (
        <div>
          {authorized && (
            <Lobby authStore={authStore} checkAuthorized={checkAuthorized} />
          )}
          {!authorized && (
            <LoginPage
              authStore={authStore}
              checkAuthorized={checkAuthorized}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default App
