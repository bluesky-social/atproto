import * as uint8arrays from 'uint8arrays'
import { BASE58_MULTIBASE_PREFIX, DID_KEY_PREFIX } from './const'

export const extractMultikey = (did: string): string => {
  if (!did.startsWith(DID_KEY_PREFIX)) {
    throw new Error(`Incorrect prefix for did:key: ${did}`)
  }
  return did.slice(DID_KEY_PREFIX.length)
}

export const extractPrefixedBytes = (multikey: string): Uint8Array => {
  if (!multikey.startsWith(BASE58_MULTIBASE_PREFIX)) {
    throw new Error(`Incorrect prefix for multikey: ${multikey}`)
  }
  return uint8arrays.fromString(
    multikey.slice(BASE58_MULTIBASE_PREFIX.length),
    'base58btc',
  )
}

export const hasPrefix = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
  return uint8arrays.equals(prefix, bytes.subarray(0, prefix.byteLength))
}
