import { p256 } from '@noble/curves/p256'
import { sha256 } from '@noble/hashes/sha256'
import { P256_JWT_ALG } from '../const'
import { parseDidKey } from '../did'
import { VerifyOptions } from '../types'

export const verifyDidSig = async (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
  opts?: VerifyOptions,
): Promise<boolean> => {
  const { jwtAlg, keyBytes } = parseDidKey(did)
  if (jwtAlg !== P256_JWT_ALG) {
    throw new Error(`Not a P-256 did:key: ${did}`)
  }
  return verifySig(keyBytes, data, sig, opts)
}

export const verifySig = async (
  publicKey: Uint8Array,
  data: Uint8Array,
  sig: Uint8Array,
  opts?: VerifyOptions,
): Promise<boolean> => {
  const msgHash = await sha256(data)
  return p256.verify(sig, msgHash, publicKey, {
    lowS: opts?.lowS ?? true,
  })
}
