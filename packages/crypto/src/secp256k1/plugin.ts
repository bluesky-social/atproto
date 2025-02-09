import { SECP256K1_DID_PREFIX, SECP256K1_JWT_ALG } from '../const'
import { DidKeyPlugin } from '../types'
import { compressPubkey, decompressPubkey } from './encoding'
import { verifyDidSig } from './operations'

export const secp256k1Plugin: DidKeyPlugin = {
  prefix: SECP256K1_DID_PREFIX,
  jwtAlg: SECP256K1_JWT_ALG,
  verifySignature: verifyDidSig,

  compressPubkey,
  decompressPubkey,
}
