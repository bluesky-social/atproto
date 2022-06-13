import * as auth from '@adxp/auth'

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
      <p>Host: {host}</p>
      <p>DID: {props.appReq.did}</p>
      <p>Scope: {props.appReq.scope}</p>
      <p>
        <button onClick={approveAppReq}>Approve</button>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <button onClick={denyAppReq}>Deny</button>
      </p>
    </div>
  )
}

export default AppApproval
