import React, { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'

import './index.css'
import Lobby from './views/Lobby'
import LoginPage from './views/LoginPage'

interface Props {}

const App: React.FC<Props> = () => {
  const [rootDid, setRootDid] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [authStore, setAuthStore] = useState<auth.AuthStore | null>(null)

  useEffect(() => {
    getAuthStore()
  }, [])

  useEffect(() => {
    checkAuthorized()
  }, [rootDid, authStore])

  const getAuthStore = async () => {
    if (authStore) return
    const browserStore = await auth.BrowserStore.load()
    setAuthStore(browserStore)
    const rootDid = localStorage.getItem('rootDid')
    if (rootDid) {
      await checkAuthorized(rootDid)
    }
  }

  const checkAuthorized = async (rootDidtoSet?: string): Promise<boolean> => {
    if (rootDidtoSet) {
      localStorage.setItem('rootDid', rootDidtoSet)
      setRootDid(rootDidtoSet)
    }
    const didToCheck = rootDidtoSet ?? rootDid
    if (!authStore || !didToCheck) {
      setAuthorized(false)
      return false
    }
    const isAuthorized = await authStore.hasUcan(auth.writeCap(didToCheck))
    setAuthorized(isAuthorized)
    return isAuthorized
  }

  const logout = (): void => {
    localStorage.removeItem('rootDid')
    setAuthorized(false)
  }

  return (
    <div>
      {!authStore && <div>Loading...</div>}
      {authStore && (
        <div>
          {authorized && rootDid && (
            <Lobby authStore={authStore} rootDid={rootDid} logout={logout} />
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
