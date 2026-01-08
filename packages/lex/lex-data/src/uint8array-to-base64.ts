import { toString } from 'uint8arrays/to-string'
import { NodeJSBuffer } from './lib/nodejs-buffer.js'
import { Base64Alphabet } from './uint8array-base64.js'

const Buffer = NodeJSBuffer

declare global {
  interface Uint8Array {
    /**
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64 Uint8Array.prototype.toBase64()}
     */
    toBase64?: (options?: {
      /** @default 'base64' */
      alphabet?: 'base64' | 'base64url'
      omitPadding?: boolean
    }) => string
  }
}

export const toBase64Native =
  typeof Uint8Array.prototype.toBase64 === 'function'
    ? function toBase64Native(
        bytes: Uint8Array,
        alphabet: Base64Alphabet = 'base64',
      ): string {
        return bytes.toBase64!({ alphabet, omitPadding: true })
      }
    : /* v8 ignore next -- @preserve */ null

export const toBase64Node = Buffer
  ? function toBase64Node(
      bytes: Uint8Array,
      alphabet: Base64Alphabet = 'base64',
    ): string {
      const buffer = bytes instanceof Buffer ? bytes : Buffer.from(bytes)
      const b64 = buffer.toString(alphabet)

      // @NOTE We strip padding for strict compatibility with
      // uint8arrays.toString behavior. Tests failing because of the presence of
      // padding are not really synonymous with an actual error and we might
      // (should?) actually want to keep the padding at some point.
      return b64.charCodeAt(b64.length - 1) === /* '=' */ 0x3d
        ? b64.charCodeAt(b64.length - 2) === /* '=' */ 0x3d
          ? b64.slice(0, -2) // '=='
          : b64.slice(0, -1) // '='
        : b64
    }
  : /* v8 ignore next -- @preserve */ null

export function toBase64Ponyfill(
  bytes: Uint8Array,
  alphabet: Base64Alphabet = 'base64',
): string {
  return toString(bytes, alphabet)
}
