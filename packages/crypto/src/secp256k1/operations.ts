import { secp256k1 as k256 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import * as ui8 from 'uint8arrays'
import { SECP256K1_JWT_ALG } from '../const'
import { parseDidKey } from '../did'
import { VerifyOptions } from '../types'

export const verifyDidSig = async (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
  opts?: VerifyOptions,
): Promise<boolean> => {
  const { jwtAlg, keyBytes } = parseDidKey(did)
  if (jwtAlg !== SECP256K1_JWT_ALG) {
    throw new Error(`Not a secp256k1 did:key: ${did}`)
  }
  return verifySig(keyBytes, data, sig, opts)
}

export const verifySig = async (
  publicKey: Uint8Array,
  data: Uint8Array,
  sig: Uint8Array,
  opts?: VerifyOptions,
): Promise<boolean> => {
  const allowMalleable = opts?.allowMalleableSig ?? false
  const msgHash = await sha256(data)
  // parse as compact sig to prevent signature malleability
  // library supports sigs in 2 different formats: https://github.com/paulmillr/noble-curves/issues/99
  if (!allowMalleable && !isCompactFormat(sig)) {
    return false
  }
  return k256.verify(sig, msgHash, publicKey, {
    lowS: !allowMalleable,
  })
}

export const isCompactFormat = (sig: Uint8Array) => {
  try {
    const parsed = k256.Signature.fromCompact(sig)
    return ui8.equals(parsed.toCompactRawBytes(), sig)
  } catch {
    return false
  }
}
