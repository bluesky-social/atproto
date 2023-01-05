import * as operations from './operations'
import { DidKeyPlugin } from '../types'
import { P256_DID_PREFIX, P256_JWT_ALG } from '../const'

export const p256Plugin: DidKeyPlugin = {
  prefix: P256_DID_PREFIX,
  jwtAlg: P256_JWT_ALG,
  verifySignature: operations.verifyDidSig,
}

export default p256Plugin
