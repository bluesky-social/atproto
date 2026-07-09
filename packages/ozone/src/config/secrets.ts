import assert from 'node:assert'
import type { OzoneEnvironment } from './env.js'

export const envToSecrets = (env: OzoneEnvironment): OzoneSecrets => {
  assert(env.adminPassword)
  assert(env.signingKeyHex)

  return {
    adminPassword: env.adminPassword,
    signingKeyHex: env.signingKeyHex,
  }
}

export type OzoneSecrets = {
  adminPassword: string
  signingKeyHex: string
}
