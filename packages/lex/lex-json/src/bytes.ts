import { fromBase64, toBase64 } from '@atproto/lex-data'
import { JsonValue } from './json.js'

export function parseLexBytes(input?: {
  $bytes?: unknown
}): Uint8Array | undefined {
  if (!input || !('$bytes' in input)) {
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

export function encodeLexBytes(bytes: Uint8Array): JsonValue {
  return { $bytes: toBase64(bytes) }
}
