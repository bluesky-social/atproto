import { P256_DID_PREFIX, P256_JWT_ALG } from '../const.js'
import type { DidKeyPlugin } from '../types.js'
import { compressPubkey, decompressPubkey } from './encoding.js'
import { verifyDidSig } from './operations.js'

export const p256Plugin: DidKeyPlugin = {
  prefix: P256_DID_PREFIX,
  jwtAlg: P256_JWT_ALG,
  verifySignature: verifyDidSig,

  compressPubkey,
  decompressPubkey,
}
