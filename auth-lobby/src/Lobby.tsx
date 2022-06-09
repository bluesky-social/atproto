import { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'
import * as awake from '@adxp/awake'
import * as env from './env'

import AppApproval, { UcanReq } from './AppApproval'

interface Props {
  authStore: auth.AuthStore
  checkAuthorized: () => Promise<void>
}

function Lobby(props: Props) {
  const [did, setDid] = useState<string>()
  const [awakeProvider, setAwakeProvider] = useState<awake.Provider | null>(
    null,
  )
  const [ucanReq, setUcanReq] = useState<UcanReq | null>(null)
  const [pin, setPin] = useState<number | null>(null)

  useEffect(() => {
    getDid()
    openProvider()
    getUcanReq()
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

  const getUcanReq = async () => {
    if (!window.opener) return
    if (ucanReq !== null) return
    window.opener.postMessage(
      {
        type: 'adxAuthReady',
      },
      '*',
    )
    const handler = (e: MessageEvent) => {
      const data = e.data
      if (data.type === 'adxAuthReq') {
        setUcanReq({
          host: data.host,
          did: data.did,
          scope: data.scope,
        })
      }
      window.removeEventListener('message', handler)
    }
    window.addEventListener('message', handler)
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
      {ucanReq && <AppApproval authStore={props.authStore} ucanReq={ucanReq} />}
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
