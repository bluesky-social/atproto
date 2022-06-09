import * as auth from '@adxp/auth'

interface Props {
  authStore: auth.AuthStore
  ucanReq: auth.UcanReq
}

function AppApproval(props: Props) {
  const approveAppReq = async () => {
    if (props.ucanReq === null) {
      throw new Error('Permission Req is null')
    }
    return auth.approveAppUcanReq(props.ucanReq, props.authStore)
  }

  const denyAppReq = async () => {
    return auth.denyAppUcanReq(props.ucanReq)
  }

  return (
    <div>
      <p>Host: {props.ucanReq.host}</p>
      <p>DID: {props.ucanReq.did}</p>
      <p>Scope: {props.ucanReq.scope}</p>
      <p>
        <button onClick={approveAppReq}>Approve</button>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <button onClick={denyAppReq}>Deny</button>
      </p>
    </div>
  )
}

export default AppApproval
