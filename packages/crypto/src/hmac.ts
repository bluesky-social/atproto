import { expand, extract } from '@noble/hashes/hkdf'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'

export const hmacSha256 = (key: Uint8Array, data: Uint8Array): Uint8Array => {
  return hmac(sha256, key, data)
}

// The two halves of HKDF, per RFC 5869 §2.2 and §2.3.
export const hkdfExtractSha256 = (
  salt: Uint8Array,
  ikm: Uint8Array,
): Uint8Array => {
  return extract(sha256, ikm, salt)
}

export const hkdfExpandSha256 = (
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array => {
  return expand(sha256, prk, info, length)
}
