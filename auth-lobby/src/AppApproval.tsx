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
    const hasIt = await props.authStore.hasUcan(
      auth.writeCap('did:key:z6MkfRiFMLzCxxnw6VMrHK8pPFt4QAHS3jX3XM87y9rta6kP'),
    )
    return auth.approveAppUcanReq(props.appReq, props.authStore)
  }

  const denyAppReq = async () => {
    return auth.denyAppUcanReq(props.appReq)
  }

  return (
    <div>
      <p>Host: {props.appReq.host}</p>
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
