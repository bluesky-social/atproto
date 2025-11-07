import { Json } from './json.js'
import { isPlainObject } from './object.js'
import { asUint8Array, fromBase64, toBase64 } from './uint8array.js'

export function parseLexBytes(input?: {
  $bytes?: unknown
}): Uint8Array | undefined {
  if (!input) {
    return undefined
  }

  for (const key in input) {
    if (key !== '$bytes') {
      return undefined
    }
  }

  if (typeof input.$bytes !== 'string') {
    throw new TypeError('$bytes must be a base64-encoded string')
  }

  return fromBase64(input.$bytes)
}

/**
 * Coerces json or Lex into a Uint8Array.
 */
export function asLexBytes(input: unknown): Uint8Array | undefined {
  const bytes = asUint8Array(input)
  if (bytes) return bytes

  if (isPlainObject(input)) {
    try {
      return parseLexBytes(input)
    } catch {
      // Ignore parse errors (invalid base64)
    }
  }

  return undefined
}

export function encodeLexBytes(bytes: Uint8Array): Json {
  return { $bytes: toBase64(bytes) }
}
