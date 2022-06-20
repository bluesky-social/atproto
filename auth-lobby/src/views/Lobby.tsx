import { useEffect, useState } from 'react'

import * as auth from '@adxp/auth'
import * as awake from '@adxp/awake'
import * as env from '../env'

import { Btn } from '../components/Btn'
import AppApproval from '../components/AppApproval'

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

  const hasTopElem = !!appReq || !!pin
  return (
    <>
      {appReq ? (
        <div className="mx-auto sm:max-w-lg sm:mt-4 sm:border sm:border-blue-600 sm:rounded-t-xl overflow-hidden">
          <h2 className="text-2xl font-bold border-b bg-blue-600 text-white px-6 py-4">
            Authorize application
          </h2>
          <div className="px-6 py-4">
            <AppApproval authStore={props.authStore} appReq={appReq} />
          </div>
        </div>
      ) : pin ? (
        <div className="mx-auto sm:max-w-lg sm:mt-4 sm:border sm:border-blue-600 sm:rounded-t-xl overflow-hidden">
          <h2 className="text-2xl font-bold border-b bg-blue-600 text-white px-6 py-4">
            New device
          </h2>
          <div className="px-6 py-4">
            <div>A device is attempting to pair with this one.</div>
            <div className="mt-4 bg-gray-100 rounded-full px-6 py-4 mb-3 text-2xl text-gray-700 font-bold text-center">
              Pin: <span className="font-mono">{pin}</span>
            </div>
            <div className="flex justify-between mb-2">
              <Btn onClick={denyPinReq}>Deny</Btn>
              <Btn type="primary" filled onClick={approvePinReq}>
                Approve
              </Btn>
            </div>
          </div>
        </div>
      ) : undefined}
      <div
        className={`mx-auto sm:max-w-lg ${
          hasTopElem
            ? 'sm:mb-4 sm:rounded-b-xl sm:border-t-0'
            : 'sm:my-4 sm:rounded-xl'
        } sm:border border-t sm:border-gray-400 border-gray-200`}
      >
        {hasTopElem === false ? (
          <h1 className="text-3xl font-bold border-b border-gray-200 px-6 py-4">
            Logged in
            <small className="text-gray-500 font-mono relative -inset-y-px ml-2">
              [dev]
            </small>
          </h1>
        ) : undefined}
        <div className="px-6 py-4">
          <div className="mb-2">Logged in as</div>
          <div className="px-4 py-3 bg-gray-100 rounded-lg font-mono overflow-auto mb-3 text-sm">
            {did}
          </div>
          <div>
            <Btn pad="px-5 py-1" onClick={logout}>
              Logout
            </Btn>
          </div>
        </div>
      </div>
    </>
  )
}

export default Lobby
