import { expand } from '@noble/hashes/hkdf'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'

export const hmacSha256 = (key: Uint8Array, data: Uint8Array): Uint8Array => {
  return hmac(sha256, key, data)
}

export const hkdfSha256 = (ikm: Uint8Array, info: Uint8Array): Uint8Array => {
  return expand(sha256, ikm, info, 32)
}
