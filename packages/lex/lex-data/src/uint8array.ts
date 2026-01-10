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
 * @returns The base64 encoded string
 */
export const toBase64: (
  bytes: Uint8Array,
  alphabet?: Base64Alphabet,
) => string =
  /* v8 ignore next -- @preserve */ toBase64Native ??
  /* v8 ignore next -- @preserve */ toBase64Node ??
  /* v8 ignore next -- @preserve */ toBase64Ponyfill

/**
 * Decodes a base64 string into a Uint8Array. This function supports both padded
 * and unpadded base64 strings.
 *
 * @returns The decoded {@link Uint8Array}
 * @throws If the input is not a valid base64 string
 */
export const fromBase64: (
  b64: string,
  alphabet?: Base64Alphabet,
) => Uint8Array =
  /* v8 ignore next -- @preserve */ fromBase64Native ??
  /* v8 ignore next -- @preserve */ fromBase64Node ??
  /* v8 ignore next -- @preserve */ fromBase64Ponyfill

/* v8 ignore next -- @preserve */
if (toBase64 === toBase64Ponyfill || fromBase64 === fromBase64Ponyfill) {
  /*#__PURE__*/
  console.warn(
    '[@atproto/lex-data]: Uint8Array.fromBase64 / Uint8Array.prototype.toBase64 not available in this environment. Falling back to ponyfill implementation.',
  )
}

/**
 * Coerces various binary data representations into a Uint8Array.
 *
 * @return `undefined` if the input could not be coerced into a {@link Uint8Array}.
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

export const ui8Concat =
  /* v8 ignore next -- @preserve */ ui8ConcatNode ??
  /* v8 ignore next -- @preserve */ ui8ConcatPonyfill
