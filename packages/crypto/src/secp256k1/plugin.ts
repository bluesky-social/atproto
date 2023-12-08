import { verifyDidSig } from './operations'
import { compressPubkey, decompressPubkey } from './encoding'

import { DidKeyPlugin } from '../types'
import { SECP256K1_DID_PREFIX, SECP256K1_JWT_ALG } from '../const'

export const secp256k1Plugin: DidKeyPlugin = {
  prefix: SECP256K1_DID_PREFIX,
  jwtAlg: SECP256K1_JWT_ALG,
  verifySignature: verifyDidSig,

  compressPubkey,
  decompressPubkey,
}

export default secp256k1Plugin
