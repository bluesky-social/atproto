import * as ucan from 'ucans'
import * as auth from '@adxp/auth'

const OWN_HOST = 'http://localhost:3000'
const AUTH_LOBBY = 'http://localhost:3001'

let keypair: ucan.EdKeypair | null = null
let ucanStore: ucan.Store | null = null

export const clear = () => {
  localStorage.clear()
  keypair = null
  ucanStore = null
}

const getKeypair = async (): Promise<ucan.EdKeypair> => {
  if (!keypair) {
    const storedKey = localStorage.getItem('adxKey')
    if (storedKey) {
      keypair = ucan.EdKeypair.fromSecretKey(storedKey)
    } else {
      keypair = await ucan.EdKeypair.create({ exportable: true })
      localStorage.setItem('adxKey', await keypair.export())
    }
  }
  return keypair
}

export const getDid = async (): Promise<string> => {
  const keypair = await getKeypair()
  return keypair.did()
}

const getStoredUcanStrs = (): string[] => {
  const storedStr = localStorage.getItem('adxUcans')
  if (!storedStr) return []
  return storedStr.split(',')
}

const setStoredUcanStrs = (ucans: string[]): void => {
  localStorage.setItem('adxUcans', ucans.join(','))
}

export const getUcanStore = async (): Promise<ucan.Store> => {
  if (!ucanStore) {
    const storedUcans = getStoredUcanStrs()
    ucanStore = await ucan.Store.fromTokens(storedUcans)
  }
  return ucanStore
}

export const acquireUcan = async (scope: string): Promise<ucan.Chained> => {
  const alreadyHave = await findUcanInStore(scope)
  if (alreadyHave) return alreadyHave

  const keypair = await getKeypair()
  const did = keypair.did()
  const lobby = window.open(AUTH_LOBBY)

  return new Promise((resolve) => {
    const handler = async (e: MessageEvent) => {
      const data = e.data
      if (data.type === 'Adx_Auth_Ready') {
        lobby?.postMessage(
          {
            type: 'Adx_Auth_Req',
            host: OWN_HOST,
            did,
            scope,
          },
          '*',
        )
      } else if (data.type === 'Adx_Auth_Success') {
        const token = await ucan.Chained.fromToken(data.ucan)
        await addUcanToStore(token)
        window.removeEventListener('message', handler)
        resolve(token)
      }
    }
    window.addEventListener('message', handler)
  })
}

export const addUcanToStore = async (token: ucan.Chained): Promise<void> => {
  const store = await getUcanStore()
  store.add(token)
  const storedUcans = getStoredUcanStrs()
  setStoredUcanStrs([...storedUcans, token.encoded()])
}

export const findUcanInStore = async (
  scope: string,
): Promise<ucan.Chained | null> => {
  const keypair = await getKeypair()
  const store = await getUcanStore()
  const cap = auth.adxCapability(scope, 'WRITE')
  const adxCap = auth.adxSemantics.tryParsing(cap)
  if (adxCap === null) return null
  const res = await store.findWithCapability(
    keypair.did(),
    auth.adxSemantics,
    adxCap,
    ({ originator, expiresAt, notBefore }) => {
      if (expiresAt * 1000 < Date.now()) return false
      if (notBefore && notBefore * 1000 > Date.now()) return false
      return originator === adxCap.did
    },
  )
  if (res.success) {
    return res.ucan
  } else {
    return null
  }
}

export const hasValidUcanInStore = async (scope: string): Promise<boolean> => {
  const found = await findUcanInStore(scope)
  return found !== null
}
