import * as secp from '@noble/secp256k1'
import { parseDidKey } from '../did'

export const verifyDidSig = async (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> => {
  const { jwtAlg, keyBytes } = parseDidKey(did)
  if (jwtAlg !== 'ES256K') {
    throw new Error(`Not a secp256k1 did:key: ${did}`)
  }
  const msgHash = await secp.utils.sha256(data)
  return secp.verify(sig, msgHash, keyBytes)
}
