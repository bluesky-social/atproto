import * as uint8arrays from 'uint8arrays'
import * as ucans from '@ucans/core'

export const verifySignature =
  (plugins: ucans.Plugins) =>
  async (did: string, data: Uint8Array, sig: Uint8Array): Promise<boolean> => {
    return plugins.verifySignature(did, data, sig)
  }

export const verifySignatureUtf8 =
  (plugins: ucans.Plugins) =>
  async (did: string, data: string, sig: string): Promise<boolean> => {
    const dataBytes = uint8arrays.fromString(data, 'utf8')
    const sigBytes = uint8arrays.fromString(sig, 'base64url')
    return verifySignature(plugins)(did, dataBytes, sigBytes)
  }
