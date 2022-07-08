import { DidKeyPlugin } from '@ucans/core'

import { P256_DID_PREFIX } from '../const'

import * as operations from './operations'

export const p256Plugin: DidKeyPlugin = {
  prefix: P256_DID_PREFIX,
  jwtAlg: 'ES256',
  verifySignature: operations.verifyDidSig,
}

export default p256Plugin
