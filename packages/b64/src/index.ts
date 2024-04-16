import {
  b64uDecode as b64uDecodeIsomorphic,
  b64uEncode as b64uEncodeIsomorphic,
} from './isomorphic.js'

// Old Node implementations do not support "base64url"
const Buffer = ((Buffer) => {
  if (typeof Buffer === 'function') {
    try {
      const buf = Buffer.from('8J-ZgA', 'base64url')
      if (buf.toString() === '🙀') return Buffer
    } catch {
      // Noop
    }
  }
  return undefined
})(globalThis.Buffer)

export const b64uDecode: (b64u: string) => Uint8Array = Buffer
  ? (b64u) => Buffer.from(b64u, 'base64url')
  : b64uDecodeIsomorphic

export const b64uEncode = Buffer
  ? (bytes: Uint8Array) => {
      const buffer = bytes instanceof Buffer ? bytes : Buffer.from(bytes)
      return buffer.toString('base64url')
    }
  : b64uEncodeIsomorphic
