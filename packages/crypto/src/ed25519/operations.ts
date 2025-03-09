import { ed25519 as ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import * as ui8 from 'uint8arrays'
import { ED25519_DID_PREFIX } from '../const'
import { VerifyOptions } from '../types'
import { extractMultikey, extractPrefixedBytes, hasPrefix } from '../utils'

export const verifyDidSig = async (
  did: string,
  data: Uint8Array,
  sig: Uint8Array,
  opts?: VerifyOptions,
): Promise<boolean> => {
  const prefixedBytes = extractPrefixedBytes(extractMultikey(did))
  if (!hasPrefix(prefixedBytes, ED25519_DID_PREFIX)) {
    throw new Error(`Not a ed25519 did:key: ${did}`)
  }
  const keyBytes = prefixedBytes.slice(ED25519_DID_PREFIX.length)
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
  return ed25519.verify(sig, msgHash, publicKey, {
    format: allowMalleable ? undefined : 'compact', // prevent DER-encoded signatures
    lowS: !allowMalleable,
  })
}

export const isCompactFormat = (sig: Uint8Array) => {
  try {
    const parsed = ed25519.Signature.fromCompact(sig)
    return ui8.equals(parsed.toCompactRawBytes(), sig)
  } catch {
    return false
  }
}
