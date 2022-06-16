import { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'

import './index.css'
import Lobby from './views/Lobby'
import LoginPage from './views/LoginPage'
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
    const browserStore = await auth.BrowserStore.load()
    setAuthStore(browserStore)
  }

  const loginAsRoot = async () => {
    const browserStore = await auth.BrowserStore.loadRootAuth(env.PRIV_KEY)
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
      {!authStore && <div>Loading...</div>}
      {authStore && (
        <div>
          {authorized && (
            <Lobby authStore={authStore} checkAuthorized={checkAuthorized} />
          )}
          {!authorized && (
            <LoginPage
              authStore={authStore}
              loginAsRoot={loginAsRoot}
              checkAuthorized={checkAuthorized}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default App
