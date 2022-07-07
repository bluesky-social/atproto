import * as uint8arrays from 'uint8arrays'
import * as ucan from './ucans'
import * as capability from './semantics'
import AuthStore from './auth-store'

export type AppUcanReq = AppUcanMessageReq | AppUcanRedirectReq

export type AppUcanMessageReq = AppUcanReqData & {
  useRedirect: false
  host: string
}

export type AppUcanRedirectReq = AppUcanReqData & {
  useRedirect: true
  redirectTo: string
}

export type AppUcanReqData = {
  did: string
  scope: string | string[]
  exp?: number
}

// REDIRECT FLOWS
// ----------------
export const requestAppUcanHashFragment = (
  did: string,
  scope: ucan.Capability,
  redirectTo: string,
  exp?: number,
): string => {
  const obj = {
    scope: scope.with.hierPart,
    did,
    redirectTo,
    exp,
  }
  return utf8ToB64(JSON.stringify(obj))
}

export const parseAppReqHashFragment = (
  fragment: string,
): AppUcanRedirectReq => {
  // @TODO validation
  return parseHashFragment(fragment) as AppUcanRedirectReq
}

export const parseLobbyResponseHashFragment = (
  fragment: string,
): Promise<ucan.Ucan> => {
  // @TODO validation
  const obj = parseHashFragment(fragment) as any
  if (obj.ucan) {
    return ucan.validate(obj.ucan)
  } else if (obj.error) {
    throw new Error(obj.error)
  } else {
    throw new Error('Invalid message received in application auth flow')
  }
}

export const approveAppHashFragment = async (
  appReq: AppUcanReq,
  authStore: AuthStore,
): Promise<string> => {
  const token = await getApprovedAppUcan(appReq, authStore)
  const msg = { ucan: ucan.encode(token) }
  return utf8ToB64(JSON.stringify(msg))
}

export const denyAppHashFragment = async (): Promise<string> => {
  const msg = { error: 'Auth request denied' }
  return utf8ToB64(JSON.stringify(msg))
}

// POST MESSAGE FLOWS
// ----------------
export const requestAppUcan = async (
  lobbyUrl: string,
  appDid: string,
  cap: ucan.Capability,
): Promise<ucan.Ucan> => {
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
        const token = await ucan.validate(data.ucan)
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

export const listenForAppUcanReq = async (): Promise<AppUcanMessageReq> => {
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
          useRedirect: false,
          host: data.host,
          did: data.did,
          scope: data.scope,
          exp: data.exp,
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

export const approveAppReq = async (
  appReq: AppUcanMessageReq,
  authStore: AuthStore,
) => {
  const token = await getApprovedAppUcan(appReq, authStore)

  window.opener.postMessage(
    {
      type: 'Adx_Auth_Success',
      ucan: ucan.encode(token),
    },
    appReq.host,
  )
  window.close()
}

export const denyAppReq = (appReq: AppUcanMessageReq) => {
  window.opener.postMessage(
    {
      type: 'Adx_Auth_Error',
      error: 'Auth request denied',
    },
    appReq.host,
  )
  window.close()
}

// UTILTIES
// ----------------

export const getApprovedAppUcan = async (
  appReq: AppUcanReq,
  authStore: AuthStore,
): Promise<ucan.Ucan> => {
  const resource =
    typeof appReq.scope === 'string' ? appReq.scope : appReq.scope[0]
  const cap = capability.adxCapability(resource, 'WRITE')
  return authStore.createUcan(appReq.did, cap)
}

const utf8ToB64 = (utf8: string): string => {
  return uint8arrays.toString(uint8arrays.fromString(utf8, 'utf8'), 'base64url')
}

const b64ToUtf8 = (b64: string): string => {
  return uint8arrays.toString(uint8arrays.fromString(b64, 'base64url'), 'utf8')
}

export const parseHashFragment = (fragment: string): unknown => {
  const trimmed = fragment.startsWith('#') ? fragment.slice(1) : fragment
  return JSON.parse(b64ToUtf8(trimmed))
}
