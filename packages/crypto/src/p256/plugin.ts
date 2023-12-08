import { verifyDidSig } from './operations'
import { compressPubkey, decompressPubkey } from './encoding'

import { DidKeyPlugin } from '../types'
import { P256_DID_PREFIX, P256_JWT_ALG } from '../const'

export const p256Plugin: DidKeyPlugin = {
  prefix: P256_DID_PREFIX,
  jwtAlg: P256_JWT_ALG,
  verifySignature: verifyDidSig,

  compressPubkey,
  decompressPubkey,
}

export default p256Plugin
