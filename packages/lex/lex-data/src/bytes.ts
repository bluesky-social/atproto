import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { Json } from './json.js'
import { NodeJSBuffer } from './lib/nodejs-buffer.js'

export function parseLexBytes(input: { $bytes?: unknown }): Uint8Array {
  if (typeof input.$bytes !== 'string') {
    throw new Error(`$bytes property must be a string`)
  }

  for (const key in input) {
    // https://atproto.com/specs/data-model
    // > Implementations should ignore unknown $ fields (to allow protocol evolution).
    if (key.codePointAt(0) === 36) {
      // Note that $link, $bytes, and $type are mutually exclusive
      if (key !== '$link' && key !== '$type') continue
    }

    throw new Error(`Invalid property in $bytes object: ${key}`)
  }

  return fromBase64(input.$bytes)
}

export function encodeLexBytes(bytes: Uint8Array): Json {
  return { $bytes: toBase64(bytes) }
}

// @NOTE Add missing lib types for Uint8Array base64 methods. These are marked
// as optional since they were very recently added and may not be available in
// all environments yet (e.g. NodeJS).
// @TODO drop dependency on uint8arrays package once Uint8Array.fromBase64 and
// Uint8Array.prototype.toBase64 are widely supported
declare global {
  interface Uint8ArrayConstructor {
    /**
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64 Uint8Array.fromBase64()}
     */
    fromBase64?: (
      b64: string,
      options?: {
        /** @default 'base64' */
        alphabet?: 'base64' | 'base64url'
        lastChunkHandling?: 'loose' | 'strict' | 'stop-before-partial'
      },
    ) => Uint8Array
  }

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

export function asUint8Array(input: unknown): Uint8Array | null {
  if (input instanceof Uint8Array) {
    return input
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / Uint8Array.BYTES_PER_ELEMENT,
    )
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }

  return null
}

export function bytesEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false
  }

  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }

  return true
}

const Buffer = NodeJSBuffer

/**
 * Decodes a base64 string into a Uint8Array.
 *
 * @returns The decoded {@link Uint8Array}
 * @throws If the input is not a valid base64 string
 */
export const fromBase64: (b64: string) => Uint8Array =
  typeof Uint8Array.fromBase64 === 'function'
    ? // Use native implementation if available (e.g. in modern browsers)
      (b64) => Uint8Array.fromBase64!(b64, { lastChunkHandling: 'loose' })
    : Buffer
      ? // Fallback to Buffer (in NodeJS environments)
        (b64) => {
          const bytes = Buffer.from(b64, 'base64')

          // NodeJS Buffer will silently ignore invalid base64 characters, so we
          // will verify the expected length to ensure the input was a valid
          // base 64 string
          const expectedByteLength = Math.floor((b64.length / 4) * 3)
          if (expectedByteLength !== bytes.length) {
            throw new Error('Invalid base64 string')
          }

          return bytes
        }
      : (b64) => fromString(b64, 'base64')

export const toBase64: (bytes: Uint8Array) => string =
  // Use native implementation if available (e.g. in modern browsers)
  typeof Uint8Array.prototype.toBase64 === 'function'
    ? (bytes) => bytes.toBase64!({ omitPadding: true })
    : Buffer
      ? // Fallback to Buffer (in NodeJS environments)
        (bytes) => {
          const b64 = (
            bytes instanceof Buffer ? bytes : Buffer.from(bytes)
          ).toString('base64')
          // @NOTE We strip padding for strict compatibility with
          // uint8arrays.toString behavior. Tests failing because of the
          // presence of padding are not really synonymous with an actual error
          // and we might (should?) actually want to keep the padding at some
          // point.
          return b64.charCodeAt(b64.length - 1) === 61
            ? b64.charCodeAt(b64.length - 2) === 61
              ? b64.slice(0, -2) // '=='
              : b64.slice(0, -1) // '='
            : b64
        }
      : (bytes) => toString(bytes, 'base64')
