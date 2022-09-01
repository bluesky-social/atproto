import * as ucans from '@ucans/core'
import { p256Plugin } from '@adxp/crypto'

const didExamplePlugin: ucans.DidMethodPlugin = {
  checkJwtAlg: (did, jwtAlg) => {
    return true
  },
  verifySignature: async (did, data, sig) => {
    return true
  },
}

export const didPlugins = new ucans.Plugins([p256Plugin], {
  example: didExamplePlugin,
})
