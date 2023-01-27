import * as operations from './operations'
import { DidKeyPlugin } from '../types'
import { SECP256K1_DID_PREFIX, SECP256K1_JWT_ALG } from '../const'

export const secp256k1Plugin: DidKeyPlugin = {
  prefix: SECP256K1_DID_PREFIX,
  jwtAlg: SECP256K1_JWT_ALG,
  verifySignature: operations.verifyDidSig,
}

export default secp256k1Plugin
