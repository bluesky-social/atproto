import * as auth from '@adxp/auth'

export type UcanReq = {
  host: string
  did: string
  scope: string | string[]
}

interface Props {
  authStore: auth.AuthStore
  ucanReq: UcanReq
}

function AppApproval(props: Props) {
  const approveAppReq = async () => {
    if (props.ucanReq === null) {
      throw new Error('Permission Req is null')
    }

    const resource =
      typeof props.ucanReq.scope === 'string'
        ? props.ucanReq.scope
        : props.ucanReq.scope[0]
    const cap = auth.adxCapability(resource, 'WRITE')
    const ucan = await props.authStore.createUcan(props.ucanReq.did, cap)

    window.opener.postMessage(
      {
        type: 'adxAuthResp',
        ucan: ucan.encoded(),
      },
      props.ucanReq.host,
    )
    window.close()
  }

  const denyAppReq = async () => {
    console.log('DENIED APP REQ')
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
