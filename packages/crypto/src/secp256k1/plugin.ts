import { SECP256K1_DID_PREFIX, SECP256K1_JWT_ALG } from '../const.js'
import type { DidKeyPlugin } from '../types.js'
import { compressPubkey, decompressPubkey } from './encoding.js'
import { verifyDidSig } from './operations.js'

export const secp256k1Plugin: DidKeyPlugin = {
  prefix: SECP256K1_DID_PREFIX,
  jwtAlg: SECP256K1_JWT_ALG,
  verifySignature: verifyDidSig,

  compressPubkey,
  decompressPubkey,
}
