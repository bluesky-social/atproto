import assert from 'assert'
import { OzoneEnvironment } from './env'

export const envToSecrets = (env: OzoneEnvironment): OzoneSecrets => {
  assert(env.signingKeyHex)

  return {
    signingKeyHex: env.signingKeyHex,
  }
}

export type OzoneSecrets = {
  signingKeyHex: string
}
