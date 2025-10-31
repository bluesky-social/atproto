import { Json } from './json.js'
import { isPlainObject } from './object.js'
import { decodeBase64, ui8ToBase64 } from './ui8.js'

export function parseLexBytes(input: unknown): Uint8Array | undefined {
  if (
    isPlainObject(input) &&
    '$bytes' in input &&
    typeof input.$bytes === 'string' &&
    Object.keys(input).length === 1
  ) {
    const value = decodeBase64(input.$bytes)
    if (value) return value
  }

  return undefined
}

export function encodeLexBytes(bytes: Uint8Array): Json {
  return { $bytes: ui8ToBase64(bytes) }
}
