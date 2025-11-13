import { Json } from './json.js'
import { fromBase64, toBase64 } from './uint8array.js'

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

export function encodeLexBytes(bytes: Uint8Array): Json {
  return { $bytes: toBase64(bytes) }
}
