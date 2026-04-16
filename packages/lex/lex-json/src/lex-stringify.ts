import { LexValue } from '@atproto/lex-data'
import { encodeSpecialJsonObject } from './special-objects'

/**
 * Serialize a Lex value to a JSON string.
 *
 * This function serializes AT Protocol data model values to JSON, automatically
 * encoding special types:
 * - `Cid` instances are encoded as `{$link: string}`
 * - `Uint8Array` instances are encoded as `{$bytes: string}` (base64)
 *
 * @param input - The Lex value to stringify
 * @returns A JSON string representation of the value
 *
 * @example
 * ```typescript
 * import { lexStringify } from '@atproto/lex'
 *
 * // Stringify with CID and bytes encoding
 * const json = lexStringify({
 *   ref: someCid,
 *   data: new Uint8Array([72, 101, 108, 108, 111])
 * })
 * // json is '{"ref":{"$link":"bafyrei..."},"data":{"$bytes":"SGVsbG8="}}'
 * ```
 */
export function lexStringify(input: LexValue): string {
  // @NOTE JSON.stringify will throw (max call stack) if the input is too deeply
  // nested, so we use a stack-based approach to avoid this.

  // @NOTE each object needs to be checked for special types before being
  // processed (similar to JSON.stringify(lexToJson(input)))

  // Handle primitives and special types at the root level
  const rootEncoded = encodeValue(input)
  if (typeof rootEncoded === 'string') {
    return rootEncoded
  }

  // For objects and arrays, use iterative approach
  let result = ''
  const stack: StackItem[] = [{ value: rootEncoded, state: 'start' }]

  while (stack.length > 0) {
    const item = stack[stack.length - 1]

    if (item.state === 'start') {
      if (Array.isArray(item.value)) {
        result += '['
        item.state = 'array'
        item.index = 0
        item.arrayValue = item.value
      } else if (item.value && typeof item.value === 'object') {
        result += '{'
        item.state = 'object'
        item.index = 0
        item.keys = Object.keys(item.value)
        item.objectValue = item.value as Record<string, unknown>
      } else {
        // This shouldn't happen as encodeValue should handle primitives
        result += JSON.stringify(item.value)
        stack.pop()
      }
    } else if (item.state === 'array') {
      const arr = item.arrayValue!
      const idx = item.index!

      if (idx >= arr.length) {
        result += ']'
        stack.pop()
        continue
      }

      if (idx > 0) {
        result += ','
      }

      const element = arr[idx]
      const encoded = encodeValue(element)

      if (typeof encoded === 'string') {
        result += encoded
        item.index = idx + 1
      } else {
        // Push the encoded value to process
        stack.push({ value: encoded, state: 'start' })
        item.index = idx + 1
      }
    } else if (item.state === 'object') {
      const obj = item.objectValue!
      const keys = item.keys!
      const idx = item.index!

      if (idx >= keys.length) {
        result += '}'
        stack.pop()
        continue
      }

      if (idx > 0) {
        result += ','
      }

      const key = keys[idx]
      result += JSON.stringify(key) + ':'

      const value = obj[key]
      const encoded = encodeValue(value)

      if (typeof encoded === 'string') {
        result += encoded
        item.index = idx + 1
      } else {
        // Push the encoded value to process
        stack.push({ value: encoded, state: 'start' })
        item.index = idx + 1
      }
    }
  }

  return result
}

type StackItem = {
  value: unknown
  state: 'start' | 'array' | 'object'
  index?: number
  keys?: string[]
  arrayValue?: readonly unknown[]
  objectValue?: Record<string, unknown>
}

/**
 * Encodes a LexValue into either a JSON string (for primitives) or
 * a JSON-compatible object/array (for complex types).
 * Special Lex types (Cid, Uint8Array) are converted to their JSON representation.
 */
function encodeValue(value: unknown): string | unknown {
  // Handle primitives
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value)
  }

  // Handle special Lex types
  if (typeof value === 'object') {
    const encoded = encodeSpecialJsonObject(value as LexValue)
    if (encoded !== undefined) {
      // Return the encoded object, which will be stringified iteratively
      return encoded
    }

    // For regular objects and arrays, return them as-is for iterative processing
    if (Array.isArray(value)) {
      return value
    }

    return value
  }

  // Unsupported type
  throw new TypeError(`Unsupported type: ${typeof value}`)
}
