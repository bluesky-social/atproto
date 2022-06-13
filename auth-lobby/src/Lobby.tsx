import { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'
import * as awake from '@adxp/awake'
import * as env from './env'

import AppApproval from './AppApproval'

interface Props {
  authStore: auth.AuthStore
  checkAuthorized: () => Promise<void>
}

function Lobby(props: Props) {
  const [did, setDid] = useState<string>()
  const [awakeProvider, setAwakeProvider] = useState<awake.Provider | null>(
    null,
  )
  const [appReq, setAppReq] = useState<auth.AppUcanReq | null>(null)
  const [pin, setPin] = useState<number | null>(null)

  useEffect(() => {
    getDid()
    openProvider()
    getAppUcanReq()
  }, [])

  const getDid = async () => {
    setDid(await props.authStore.getDid())
  }

  const logout = async () => {
    if (awakeProvider) {
      awakeProvider.close()
    }
    await props.authStore.reset()
    props.checkAuthorized()
  }

  const getAppUcanReq = async () => {
    if (appReq !== null) return
    const frag = window.location.hash
    if (frag.length > 0) {
      const req = auth.parseAppReqHashFragment(frag)
      setAppReq({
        ...req,
        useRedirect: true,
      })
    } else {
      if (!window.opener) return
      const req = await auth.listenForAppUcanReq()
      setAppReq(req)
    }
  }

  const openProvider = async () => {
    if (awakeProvider) return
    const provider = await awake.Provider.create(
      env.RELAY_HOST,
      env.ROOT_USER,
      props.authStore,
    )
    setAwakeProvider(provider)
    announceProvision(provider)
  }

  const announceProvision = async (provider = awakeProvider) => {
    if (!provider) return
    const pin = await provider.attemptProvision()
    setPin(pin)
  }

  const approvePinReq = () => {
    if (awakeProvider) {
      awakeProvider.approvePinAndDelegateCred()
    }
    setPin(null)
    announceProvision()
  }

  const denyPinReq = () => {
    if (awakeProvider) {
      awakeProvider.denyPin()
    }
    setPin(null)
    announceProvision()
  }

  return (
    <div>
      <p>Logged in as {did}</p>
      <button onClick={logout}>Logout</button>
      {appReq && <AppApproval authStore={props.authStore} appReq={appReq} />}
      {pin && (
        <div>
          <p>Pin: {pin}</p>
          <p>
            <button onClick={approvePinReq}>Approve</button>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <button onClick={denyPinReq}>Deny</button>
          </p>
        </div>
      )}
    </div>
  )
}

export default Lobby
