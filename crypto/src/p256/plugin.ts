import { DidKeyPlugin } from '@ucans/core'
import { P256_DID_PREFIX } from '../const.js'
import * as encoding from './encoding.js'
import * as operations from './operations.js'

export const p256Plugin: DidKeyPlugin = {
  prefix: P256_DID_PREFIX,
  jwtAlg: 'ES256',
  verifySignature: async (did: string, data: Uint8Array, sig: Uint8Array) => {
    const publicKey = encoding.pubkeyBytesFromDid(did)
    return operations.verify(publicKey, data, sig)
  },
}

export default p256Plugin
