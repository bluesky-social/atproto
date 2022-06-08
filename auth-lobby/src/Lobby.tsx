import { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'
import * as awake from '@adxp/awake'
import * as env from './env'

import AppApproval, { UcanReq } from './AppApproval'

interface Props {
  authStore: auth.AuthStore
  checkAuthorized: () => Promise<void>
}

function Authorized(props: Props) {
  const [did, setDid] = useState<string>()
  const [awakeProvider, setAwakeProvider] = useState<awake.Provider | null>(
    null,
  )
  const [ucanReq, setUcanReq] = useState<UcanReq | null>(null)
  const [pinParams, setPinParams] = useState<awake.PinParams | null>(null)

  useEffect(() => {
    openProvider()
    getDid()
    getUcanReq()
  }, [])

  const openProvider = async () => {
    if (awakeProvider) return
    const provider = await awake.Provider.openChannel(
      env.RELAY_HOST,
      env.ROOT_USER,
      props.authStore,
      setPinParams,
    )
    setAwakeProvider(provider)
  }

  const getDid = async () => {
    setDid(await props.authStore.getDid())
  }

  const logout = () => {
    props.authStore.reset()
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

  const approvePinReq = () => {
    if (awakeProvider && pinParams) {
      awakeProvider.verifyPinAndDelegateCred(pinParams.channelDid)
    }
  }

  const denyPinReq = () => {
    if (awakeProvider && pinParams) {
      awakeProvider.denyPin(pinParams.channelDid)
    }
  }

  return (
    <div>
      <p>Logged in as {did}</p>
      <button onClick={logout}>Logout</button>
      {ucanReq && <AppApproval authStore={props.authStore} ucanReq={ucanReq} />}
      {pinParams && (
        <div>
          <p>Pin: {pinParams.pin}</p>
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

export default Authorized
