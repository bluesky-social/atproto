import { fromBase64, toBase64 } from '@atproto/lex-data'
import { JsonValue } from './json.js'

/**
 * Parses a `{$bytes: string}` JSON object into a `Uint8Array`.
 *
 * In the AT Protocol data model, binary data is represented in JSON as an object
 * with a single `$bytes` property containing a base64-encoded string. This function
 * decodes that representation back into raw bytes.
 *
 * @param input - An object potentially containing a `$bytes` property
 * @returns The decoded `Uint8Array` if the input is a valid `$bytes` object,
 *          or `undefined` if the input is not a valid `$bytes` representation
 *
 * @example
 * ```typescript
 * // Parse a $bytes object to Uint8Array
 * const bytes = parseLexBytes({ $bytes: 'SGVsbG8sIHdvcmxkIQ==' })
 * // bytes is Uint8Array containing "Hello, world!"
 *
 * // Returns undefined for non-$bytes objects
 * const result = parseLexBytes({ foo: 'bar' })
 * // result is undefined
 *
 * // Returns undefined for objects with extra properties
 * const invalid = parseLexBytes({ $bytes: 'SGVsbG8=', extra: true })
 * // invalid is undefined
 * ```
 */
export function parseLexBytes(
  input?: Record<string, unknown>,
): Uint8Array | undefined {
  if (!input || !('$bytes' in input)) {
    return undefined
  }

  for (const key in input) {
    if (key !== '$bytes') {
      return undefined
    }
  }

  if (typeof input.$bytes !== 'string') {
    return undefined
  }

  try {
    return fromBase64(input.$bytes)
  } catch {
    return undefined
  }
}

/**
 * Encodes a `Uint8Array` into a `{$bytes: string}` JSON representation.
 *
 * In the AT Protocol data model, binary data is represented in JSON as an object
 * with a single `$bytes` property containing a base64-encoded string. This function
 * performs that encoding.
 *
 * @param bytes - The binary data to encode
 * @returns An object with a `$bytes` property containing the base64-encoded data
 *
 * @example
 * ```typescript
 * const bytes = new TextEncoder().encode('Hello, world!')
 * const encoded = encodeLexBytes(bytes)
 * // encoded is { $bytes: 'SGVsbG8sIHdvcmxkIQ==' }
 * ```
 */
export function encodeLexBytes(bytes: Uint8Array): JsonValue {
  return { $bytes: toBase64(bytes) }
}
