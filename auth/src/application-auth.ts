import * as ucan from 'ucans'
import * as capability from './capability.js'
import AuthStore from './auth-store.js'

export type AppUcanReq = {
  host: string
  did: string
  scope: string | string[]
}

export const acquireAppUcan = async (
  lobbyUrl: string,
  appDid: string,
  cap: ucan.Capability,
): Promise<ucan.Chained> => {
  const lobby = window.open(lobbyUrl)
  const ownUrl = window.location.origin

  return new Promise((resolve, reject) => {
    const handler = async (e: MessageEvent) => {
      const data = e.data
      if (data.type === 'Adx_Auth_Ready') {
        lobby?.postMessage(
          {
            type: 'Adx_Auth_Req',
            host: ownUrl,
            did: appDid,
            scope: cap.with.hierPart,
          },
          lobbyUrl,
        )
      } else if (data.type === 'Adx_Auth_Success') {
        const token = await ucan.Chained.fromToken(data.ucan)
        window.removeEventListener('message', handler)
        resolve(token)
      } else if (data.type === 'Adx_Auth_Error') {
        window.removeEventListener('message', handler)
        reject(new Error(data.error))
      }
    }
    window.addEventListener('message', handler)
  })
}

export const listenForAppUcanReq = async (): Promise<AppUcanReq> => {
  if (!window.opener) {
    throw new Error('Could not find window.opener')
  }
  return new Promise((resolve) => {
    // listen for auth requester
    const handler = (e: MessageEvent) => {
      const data = e.data
      if (data.type === 'Adx_Auth_Req') {
        window.removeEventListener('message', handler)
        resolve({
          host: data.host,
          did: data.did,
          scope: data.scope,
        })
      }
    }
    window.addEventListener('message', handler)

    // tell application we're ready for auth reqeusts
    window.opener.postMessage(
      {
        type: 'Adx_Auth_Ready',
      },
      '*',
    )
  })
}

export const approveAppUcanReq = async (
  appReq: AppUcanReq,
  authStore: AuthStore,
) => {
  const resource =
    typeof appReq.scope === 'string' ? appReq.scope : appReq.scope[0]
  const cap = capability.adxCapability(resource, 'WRITE')
  const ucan = await authStore.createUcan(appReq.did, cap)

  window.opener.postMessage(
    {
      type: 'Adx_Auth_Success',
      ucan: ucan.encoded(),
    },
    appReq.host,
  )
  window.close()
}

export const denyAppUcanReq = (appReq: AppUcanReq) => {
  window.opener.postMessage(
    {
      type: 'Adx_Auth_Error',
      error: 'Auth request denied',
    },
    appReq.host,
  )
  window.close()
}
