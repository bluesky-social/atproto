import { toString } from 'uint8arrays/to-string'
import { NodeJSBuffer } from './lib/nodejs-buffer.js'

const Buffer = NodeJSBuffer

export type ToBase64Options = {
  /** @default 'base64' */
  alphabet?: 'base64' | 'base64url'
  /** @default true */
  omitPadding?: boolean
}

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
        options?: ToBase64Options,
      ): string {
        return bytes.toBase64!({
          alphabet: options?.alphabet ?? 'base64',
          omitPadding: options?.omitPadding ?? true,
        })
      }
    : null

export const toBase64Node = Buffer
  ? function toBase64Node(
      bytes: Uint8Array,
      options?: ToBase64Options,
    ): string {
      const b64 = (
        bytes instanceof Buffer ? bytes : Buffer.from(bytes)
      ).toString(options?.alphabet ?? 'base64')

      if (options?.omitPadding ?? true) {
        return b64.charCodeAt(b64.length - 1) === /* '=' */ 0x3d
          ? b64.charCodeAt(b64.length - 2) === /* '=' */ 0x3d
            ? b64.slice(0, -2) // '=='
            : b64.slice(0, -1) // '='
          : b64
      }

      return b64
    }
  : null

export function toBase64Ponyfill(
  bytes: Uint8Array,
  options?: ToBase64Options,
): string {
  const omitPadding = options?.omitPadding ?? true

  return toString(
    bytes,
    `${options?.alphabet ?? 'base64'}${omitPadding ? '' : 'pad'}`,
  )
}
