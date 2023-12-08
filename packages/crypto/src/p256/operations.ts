import { p256 } from '@noble/curves/p256'
import { sha256 } from '@noble/hashes/sha256'
import { equals as ui8equals } from 'uint8arrays'

import { P256_DID_PREFIX } from '../const'
import { VerifyOptions } from '../types'
import { extractMultikey, extractPrefixedBytes, hasPrefix } from '../utils'

export const verifyDidSig = async (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
  opts?: VerifyOptions,
): Promise<boolean> => {
  const prefixedBytes = extractPrefixedBytes(extractMultikey(did))
  if (!hasPrefix(prefixedBytes, P256_DID_PREFIX)) {
    throw new Error(`Not a P-256 did:key: ${did}`)
  }
  const keyBytes = prefixedBytes.slice(P256_DID_PREFIX.length)
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
  return p256.verify(sig, msgHash, publicKey, {
    lowS: !allowMalleable,
  })
}

export const isCompactFormat = (sig: Uint8Array) => {
  try {
    const parsed = p256.Signature.fromCompact(sig)
    return ui8equals(parsed.toCompactRawBytes(), sig)
  } catch {
    return false
  }
}
