import { JsonValue } from './json.js'

export const DEFAULT_MAX_DEPTH = 10000

export type JsonStringifyDeepOptions = {
  /**
   * Maximum depth to serialize. This is a safeguard against infinite recursion
   * in case of circular references.
   *
   * @default DEFAULT_MAX_DEPTH
   */
  maxDepth?: number
}

/**
 * A custom JSON stringifier that can handle deeply nested structures without
 * hitting call stack limits. It uses an iterative approach with an explicit
 * stack to traverse the input structure.
 *
 * This function is designed to handle JSON values that may be deeply nested,
 * which can cause `JSON.stringify` to throw a `RangeError` due to exceeding the
 * maximum call stack size. By using an iterative approach, this function can
 * serialize structures with much greater depth without crashing.
 */
export function jsonStringifyDeep(
  input: JsonValue,
  options?: JsonStringifyDeepOptions,
): string {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  // Handle primitives and special types at the root level
  const rootEncoded = encodePrimitive(input)
  if (rootEncoded !== undefined) {
    return rootEncoded
  }

  // For objects and arrays, use iterative approach
  let result = ''
  const stack: StackItem[] = [{ value: input, state: 'start', depth: 0 }]

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
        throw new Error('Unexpected non-object/array value in stack')
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
      const encoded = encodePrimitive(element)

      if (encoded !== undefined) {
        result += encoded
        item.index = idx + 1
      } else {
        if (item.depth >= maxDepth) {
          throw new TypeError(`Input is too deeply nested at index ${idx}`)
        }
        // Push the encoded value to process
        stack.push({ value: element, state: 'start', depth: item.depth + 1 })
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
      const encoded = encodePrimitive(value)

      if (encoded !== undefined) {
        result += encoded
        item.index = idx + 1
      } else {
        if (item.depth >= maxDepth) {
          throw new TypeError(`Input is too deeply nested at index ${idx}`)
        }
        // Push the encoded value to process
        stack.push({ value: value, state: 'start', depth: item.depth + 1 })
        item.index = idx + 1
      }
    }
  }

  return result
}

type StackItem = {
  value: unknown
  state: 'start' | 'array' | 'object'
  depth: number
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
function encodePrimitive(value: unknown): string | undefined {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      return undefined
    case 'string':
    case 'number':
    case 'boolean':
      return JSON.stringify(value)
    default:
      throw new TypeError(`Unsupported type: ${typeof value}`)
  }
}
