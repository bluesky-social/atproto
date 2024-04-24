// This implementation uses base64-js to encode and decode base64url strings.

import { fromByteArray, toByteArray } from 'base64-js'

export const b64uDecode = (b64u: string): Uint8Array => {
  // toByteArray requires padding but not to replace '-' and '_'
  const pad = b64u.length % 4
  const b64 = b64u.padEnd(b64u.length + (pad > 0 ? 4 - pad : 0), '=')
  return toByteArray(b64)
}

export const b64uEncode = (bytes: Uint8Array): string =>
  fromByteArray(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
