import { hkdf } from '@noble/hashes/hkdf'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'

export const hmacSha256 = (key: Uint8Array, data: Uint8Array): Uint8Array => {
  return hmac(sha256, key, data)
}

// Full HKDF (extract then expand), per RFC 5869.
export const hkdfSha256 = (
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array => {
  return hkdf(sha256, ikm, salt, info, length)
}
