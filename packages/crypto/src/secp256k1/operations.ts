import * as secp from '@noble/secp256k1'
import { SECP256K1_JWT_ALG } from '../const'
import { parseDidKey } from '../did'

export const verifyDidSig = async (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> => {
  const { jwtAlg, keyBytes } = parseDidKey(did)
  if (jwtAlg !== SECP256K1_JWT_ALG) {
    throw new Error(`Not a secp256k1 did:key: ${did}`)
  }
  const msgHash = await secp.utils.sha256(data)
  return secp.verify(sig, msgHash, keyBytes)
}
