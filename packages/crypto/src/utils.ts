import * as uint8arrays from 'uint8arrays'
import { BASE58_MULTIBASE_PREFIX, DID_KEY_PREFIX } from './const.js'

export const extractMultikey = (did: string): string => {
  if (!did.startsWith(DID_KEY_PREFIX)) {
    throw new Error(`Incorrect prefix for did:key: ${did}`)
  }
  return did.slice(DID_KEY_PREFIX.length)
}

// The largest key these helpers handle is an uncompressed 65-byte public key
// (plus a 2-byte multicodec prefix), which is about 92 characters in
// base58btc. Longer inputs are rejected before decoding because the base58btc
// decoder in uint8arrays runs in time quadratic in the input length, and keys
// come from untrusted DID documents.
const MAX_BASE58_KEY_LENGTH = 128

/**
 * Length-bounded base58btc decode for public key material.
 *
 * @throws if the input is too long to be a supported public key, or is not
 * valid base58btc.
 */
export const base58ToKeyBytes = (str: string): Uint8Array => {
  if (str.length > MAX_BASE58_KEY_LENGTH) {
    throw new Error(
      `base58btc key too long (${str.length} > ${MAX_BASE58_KEY_LENGTH})`,
    )
  }
  return uint8arrays.fromString(str, 'base58btc')
}

export const extractPrefixedBytes = (multikey: string): Uint8Array => {
  if (!multikey.startsWith(BASE58_MULTIBASE_PREFIX)) {
    throw new Error(`Incorrect prefix for multikey: ${multikey}`)
  }
  return base58ToKeyBytes(multikey.slice(BASE58_MULTIBASE_PREFIX.length))
}

export const hasPrefix = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
  return uint8arrays.equals(prefix, bytes.subarray(0, prefix.byteLength))
}
