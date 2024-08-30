import * as uint8arrays from 'uint8arrays'
import { parseDidKey } from './did'
import plugins from './plugins'
import { VerifyOptions } from './types'

export const verifySignature = (
  didKey: string,
  data: Uint8Array,
  sig: Uint8Array,
  opts?: VerifyOptions & {
    jwtAlg?: string
  },
): Promise<boolean> => {
  const parsed = parseDidKey(didKey)
  if (opts?.jwtAlg && opts.jwtAlg !== parsed.jwtAlg) {
    throw new Error(`Expected key alg ${opts.jwtAlg}, got ${parsed.jwtAlg}`)
  }
  const plugin = plugins.find((p) => p.jwtAlg === parsed.jwtAlg)
  if (!plugin) {
    throw new Error(`Unsupported signature alg: ${parsed.jwtAlg}`)
  }
  return plugin.verifySignature(didKey, data, sig, opts)
}

export const verifySignatureUtf8 = async (
  didKey: string,
  data: string,
  sig: string,
  opts?: VerifyOptions,
): Promise<boolean> => {
  const dataBytes = uint8arrays.fromString(data, 'utf8')
  const sigBytes = uint8arrays.fromString(sig, 'base64url')
  return verifySignature(didKey, dataBytes, sigBytes, opts)
}
