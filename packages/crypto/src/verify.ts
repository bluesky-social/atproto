import { parseDidKey } from './did'
import plugins from './plugins'

export const verifyDidSig = (
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
