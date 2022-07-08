import * as uint8arrays from 'uint8arrays'
import { didPlugins } from './ucans/plugins'

export const verifySignature = async (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> => {
  return didPlugins.verifySignature(did, data, sig)
}

export const verifySignatureUtf8 = async (
  did: string,
  data: string,
  sig: string,
): Promise<boolean> => {
  const dataBytes = uint8arrays.fromString(data, 'utf8')
  const sigBytes = uint8arrays.fromString(sig, 'base64url')
  return verifySignature(did, dataBytes, sigBytes)
}
