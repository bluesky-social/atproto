import * as auth from '@adxp/auth'

import { Btn } from './Btn'

interface Props {
  authStore: auth.AuthStore
  appReq: auth.AppUcanReq
}

function AppApproval(props: Props) {
  const approveAppReq = async () => {
    if (props.appReq === null) {
      throw new Error('Permission Req is null')
    }
    if (props.appReq.useRedirect) {
      const fragment = await auth.approveAppHashFragment(
        props.appReq,
        props.authStore,
      )
      window.location.href = `${props.appReq.redirectTo}#${fragment}`
    } else {
      return auth.approveAppReq(props.appReq, props.authStore)
    }
  }

  const denyAppReq = async () => {
    if (props.appReq.useRedirect) {
      const fragment = await auth.denyAppHashFragment()
      window.location.href = `${props.appReq.redirectTo}#${fragment}`
    } else {
      return auth.denyAppReq(props.appReq)
    }
  }

  // @TODO only show host with no paths
  const host = props.appReq.useRedirect
    ? props.appReq.redirectTo
    : props.appReq.host

  return (
    <div>
      <div className="mb-3">
        The application{' '}
        <a
          className="text-blue-600 hover:underline"
          href={host}
          target="_blank"
        >
          {host}
        </a>{' '}
        is attempting to log in to your account.
      </div>

      <div className="px-4 py-3 bg-gray-100 rounded-lg mb-4 font-mono text-sm overflow-auto">
        <div>Host: {host}</div>
        <div>DID: {props.appReq.did}</div>
        <div>Scope: {props.appReq.scope}</div>
      </div>

      <div className="flex justify-between mb-2">
        <Btn onClick={denyAppReq}>Deny</Btn>
        <Btn type="primary" filled onClick={approveAppReq}>
          Allow
        </Btn>
      </div>
    </div>
  )
}

export default AppApproval
