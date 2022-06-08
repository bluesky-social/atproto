import { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'

import BrowserStore from './BrowserStore'
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
    const browserStore = await BrowserStore.load()
    setAuthStore(browserStore)
  }

  const checkAuthorized = async () => {
    if (!authStore) {
      setAuthorized(false)
      return
    }
    const isAuthorized = await authStore.hasUcan(env.SCOPE)
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
