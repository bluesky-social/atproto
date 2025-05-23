import { ED25519_DID_PREFIX, ED25519_JWT_ALG } from '../const'
import { DidKeyPlugin } from '../types'
import { compressPubkey, decompressPubkey } from './encoding'
import { verifyDidSig } from './operations'

export const ed25519Plugin: DidKeyPlugin = {
  prefix: ED25519_DID_PREFIX,
  jwtAlg: ED25519_JWT_ALG,
  verifySignature: verifyDidSig,

  compressPubkey,
  decompressPubkey,
}
