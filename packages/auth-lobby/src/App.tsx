import React, { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'

import './index.css'
import Lobby from './views/Lobby'
import LoginPage from './views/LoginPage'
import * as env from './env'

interface Props {}

const App: React.FC<Props> = () => {
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
    const jwk = JSON.parse(env.PRIV_KEY)
    const browserStore = await auth.BrowserStore.loadRootAuth(jwk)
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
