import * as uint8arrays from 'uint8arrays'
import { parseDidKey } from './did'
import plugins from './plugins'

export const verifySignature = (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> => {
  const parsed = parseDidKey(did)
  const plugin = plugins.find((p) => p.jwtAlg === parsed.jwtAlg)
  if (!plugin) {
    throw new Error(`Unsupported signature alg: :${parsed.jwtAlg}`)
  }
  return plugin.verifySignature(did, data, sig)
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
