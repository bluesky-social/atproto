import { P256_DID_PREFIX, P256_JWT_ALG } from '../const'
import { DidKeyPlugin } from '../types'
import { compressPubkey, decompressPubkey } from './encoding'
import { verifyDidSig } from './operations'

export const p256Plugin: DidKeyPlugin = {
  prefix: P256_DID_PREFIX,
  jwtAlg: P256_JWT_ALG,
  verifySignature: verifyDidSig,

  compressPubkey,
  decompressPubkey,
}
