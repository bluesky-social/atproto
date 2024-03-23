import { fromByteArray, toByteArray } from 'base64-js'

const Buffer = globalThis.Buffer

export const b64uDecode: (b64u: string) => Uint8Array =
  typeof Buffer === 'function'
    ? (b64u) => Buffer.from(b64u, 'base64url')
    : (b64u) => {
        // toByteArray requires padding but not to replace '-' and '_'
        const pad = b64u.length % 4
        const b64 = b64u.padEnd(b64u.length + (pad > 0 ? 4 - pad : 0), '=')
        return toByteArray(b64)
      }

export const b64uEncode =
  typeof Buffer === 'function'
    ? (bytes: Uint8Array) => {
        const buffer = bytes instanceof Buffer ? bytes : Buffer.from(bytes)
        return buffer.toString('base64url')
      }
    : (bytes: Uint8Array): string =>
        fromByteArray(bytes)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/g, '')
