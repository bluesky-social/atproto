import assert from 'assert'
import { OzoneEnvironment } from './env'

export const envToSecrets = (env: OzoneEnvironment): OzoneSecrets => {
  assert(env.adminPassword)
  assert(env.moderatorPassword)
  assert(env.triagePassword)
  assert(env.signingKeyHex)

  return {
    adminPassword: env.adminPassword,
    moderatorPassword: env.moderatorPassword,
    triagePassword: env.triagePassword,
    signingKeyHex: env.signingKeyHex,
  }
}

export type OzoneSecrets = {
  adminPassword: string
  moderatorPassword: string
  triagePassword: string
  signingKeyHex: string
}
