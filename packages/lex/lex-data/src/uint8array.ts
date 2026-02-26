import { Base64Alphabet } from './uint8array-base64.js'
import { ui8ConcatNode, ui8ConcatPonyfill } from './uint8array-concat.js'
import {
  fromBase64Native,
  fromBase64Node,
  fromBase64Ponyfill,
} from './uint8array-from-base64.js'
import {
  toBase64Native,
  toBase64Node,
  toBase64Ponyfill,
} from './uint8array-to-base64.js'

export type { Base64Alphabet }

// @TODO drop dependency on uint8arrays package once Uint8Array.fromBase64 /
// Uint8Array.prototype.toBase64 is widely supported, and mark fromBase64 /
// toBase64 as deprecated. We can also drop NodeJS specific implementations
// once NodeJS <24 is no longer supported.

/**
 * Encodes a Uint8Array into a base64 string.
 *
 * Uses native Uint8Array.prototype.toBase64 when available (Node.js 24+, modern browsers),
 * falling back to Node.js Buffer or a ponyfill implementation.
 *
 * @param bytes - The binary data to encode
 * @param alphabet - The base64 alphabet to use ('base64' or 'base64url'), defaults to 'base64'
 * @returns The base64 encoded string
 *
 * @example
 * ```typescript
 * import { toBase64 } from '@atproto/lex-data'
 *
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * toBase64(bytes)           // 'SGVsbG8='
 * toBase64(bytes, 'base64url')  // 'SGVsbG8' (URL-safe, no padding)
 * ```
 */
export const toBase64: (
  bytes: Uint8Array,
  alphabet?: Base64Alphabet,
) => string =
  /* v8 ignore next -- @preserve */ toBase64Native ??
  toBase64Node ??
  toBase64Ponyfill

/**
 * Decodes a base64 string into a Uint8Array.
 *
 * Supports both padded and unpadded base64 strings. Uses native
 * Uint8Array.fromBase64 when available, falling back to Node.js Buffer
 * or a ponyfill implementation.
 *
 * @param b64 - The base64 string to decode
 * @param alphabet - The base64 alphabet to use ('base64' or 'base64url'), defaults to 'base64'
 * @returns The decoded binary data
 * @throws If the input is not a valid base64 string
 *
 * @example
 * ```typescript
 * import { fromBase64 } from '@atproto/lex-data'
 *
 * fromBase64('SGVsbG8=')       // Uint8Array([72, 101, 108, 108, 111])
 * fromBase64('SGVsbG8', 'base64url')  // Same, URL-safe alphabet
 * ```
 */
export const fromBase64: (
  b64: string,
  alphabet?: Base64Alphabet,
) => Uint8Array =
  /* v8 ignore next -- @preserve */ fromBase64Native ??
  fromBase64Node ??
  fromBase64Ponyfill

/* v8 ignore next -- @preserve */
if (toBase64 === toBase64Ponyfill || fromBase64 === fromBase64Ponyfill) {
  /*#__PURE__*/
  console.warn(
    '[@atproto/lex-data]: Uint8Array.fromBase64 / Uint8Array.prototype.toBase64 not available in this environment. Falling back to ponyfill implementation.',
  )
}

/**
 * Returns the input if it is a Uint8Array, otherwise returns undefined.
 *
 * @param input - The value to check
 * @returns The input if it's a Uint8Array, otherwise undefined
 *
 * @example
 * ```typescript
 * import { ifUint8Array } from '@atproto/lex-data'
 *
 * ifUint8Array(new Uint8Array([1, 2]))  // Uint8Array([1, 2])
 * ifUint8Array('not binary')            // undefined
 * ifUint8Array(new ArrayBuffer(4))      // undefined
 * ```
 */
export function ifUint8Array(input: unknown): Uint8Array | undefined {
  if (input instanceof Uint8Array) {
    return input
  }

  return undefined
}

/**
 * Coerces various binary data representations into a Uint8Array.
 *
 * Handles the following input types:
 * - `Uint8Array` - Returned as-is
 * - `ArrayBufferView` (e.g., DataView, other TypedArrays) - Converted to Uint8Array
 * - `ArrayBuffer` - Wrapped in a Uint8Array
 *
 * @param input - The value to convert
 * @returns A Uint8Array, or `undefined` if the input could not be converted
 *
 * @example
 * ```typescript
 * import { asUint8Array } from '@atproto/lex-data'
 *
 * asUint8Array(new Uint8Array([1, 2]))     // Uint8Array([1, 2])
 * asUint8Array(new ArrayBuffer(4))         // Uint8Array of length 4
 * asUint8Array(new Int16Array([1, 2]))     // Uint8Array view of the buffer
 * asUint8Array('string')                   // undefined
 * ```
 */
export function asUint8Array(input: unknown): Uint8Array | undefined {
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

  return undefined
}

/**
 * Compares two Uint8Arrays for byte-by-byte equality.
 *
 * @param a - First Uint8Array to compare
 * @param b - Second Uint8Array to compare
 * @returns `true` if both arrays have the same length and identical bytes
 *
 * @example
 * ```typescript
 * import { ui8Equals } from '@atproto/lex-data'
 *
 * ui8Equals(new Uint8Array([1, 2]), new Uint8Array([1, 2]))  // true
 * ui8Equals(new Uint8Array([1, 2]), new Uint8Array([1, 3]))  // false
 * ui8Equals(new Uint8Array([1]), new Uint8Array([1, 2]))     // false
 * ```
 */
export function ui8Equals(a: Uint8Array, b: Uint8Array): boolean {
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

/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 *
 * Uses Node.js Buffer.concat when available for performance,
 * falling back to a ponyfill implementation.
 *
 * @param arrays - The Uint8Arrays to concatenate
 * @returns A new Uint8Array containing all input bytes in order
 *
 * @example
 * ```typescript
 * import { ui8Concat } from '@atproto/lex-data'
 *
 * const a = new Uint8Array([1, 2])
 * const b = new Uint8Array([3, 4])
 * ui8Concat([a, b])  // Uint8Array([1, 2, 3, 4])
 * ```
 */
export const ui8Concat =
  /* v8 ignore next -- @preserve */ ui8ConcatNode ?? ui8ConcatPonyfill
