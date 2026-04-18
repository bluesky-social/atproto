import { JsonValue } from './json.js'
import {
  MAX_DEPTH,
  ParentRef,
  StackFrame,
  StackFrameOptions,
  createStackFrame,
  stringifyPath,
} from './lib/stack-frame.js'

const MAX_ARRAY_LENGTH = 10_000
const MAX_OBJECT_ENTRIES = 10_000

const OMIT = Symbol('OMIT')
const OBJECT = Symbol('object')

export type JsonStringifyDeepOptions = {
  /**
   * Maximum depth to serialize. This is a safeguard against infinite recursion
   * in case of circular references.
   *
   * @default DEFAULT_MAX_DEPTH
   */
  maxDepth?: number
  /**
   * Maximum length of arrays to serialize. This is a safeguard against
   * excessively large arrays.
   *
   * @default MAX_ARRAY_LENGTH
   */
  maxArrayLength?: number
  /**
   * Maximum number of entries in objects to serialize. This is a safeguard
   * against excessively large objects.
   *
   * @default MAX_OBJECT_ENTRIES
   */
  maxObjectEntries?: number
}

type RawFrame = {
  type: 'raw'
  string: string
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
  {
    maxDepth = MAX_DEPTH,
    maxArrayLength = MAX_ARRAY_LENGTH,
    maxObjectEntries = MAX_OBJECT_ENTRIES,
  }: JsonStringifyDeepOptions = {},
): string {
  // Handle primitives and special types at the root level
  const inputValue = encodePrimitive(input)
  if (inputValue === OMIT) {
    // @NOTE That JSON.stringify(undefined) returns undefined (although it is
    // not typed as such in TypeScript, and not valid JSON). We disallow this
    // since it is not a valid JSON value and is likely an error in the input
    // data.
    throw new TypeError('Invalid undefined value at $')
  }
  if (inputValue !== OBJECT) {
    return inputValue
  }

  // For objects and arrays, use iterative approach
  const options: StackFrameOptions = {
    maxDepth,
    maxArrayLength,
    maxObjectEntries,
  }

  const rootFrame = createStackFrame(input as object, undefined, options)
  const stack: (StackFrame | RawFrame)[] = [rootFrame]

  let result = ''
  while (stack.length > 0) {
    const frame = stack.pop()!
    if (frame.type === 'array') {
      if (frame.input.length === 0) {
        result += '[]'
        continue
      }

      const { input } = frame
      result += '['
      stack.push({ type: 'raw', string: ']' })
      for (let index = input.length - 1; index >= 0; index--) {
        const element = input[index]
        const parent: ParentRef = { frame, index }
        const encoded = encodePrimitive(element, parent)

        if (index < input.length - 1) {
          stack.push({ type: 'raw', string: ',' })
        }

        if (encoded === OBJECT) {
          stack.push(createStackFrame(element as object, parent, options))
        } else if (encoded === OMIT) {
          // JSON.stringify replaces undefined values in arrays with null
          stack.push({ type: 'raw', string: 'null' })
        } else {
          stack.push({ type: 'raw', string: encoded })
        }
      }
    } else if (frame.type === 'object') {
      const { entries } = frame

      if (entries.length === 0) {
        result += '{}'
        continue
      }

      result += '{'
      stack.push({ type: 'raw', string: '}' })
      for (let index = entries.length - 1; index >= 0; index--) {
        const [key, value] = entries[index]
        const parent: ParentRef = { frame, index }
        const encodedValue = encodePrimitive(value, parent)

        if (encodedValue === OMIT) {
          // Omit this property (undefined values should be removed)
          continue
        }

        if (index < entries.length - 1) {
          stack.push({ type: 'raw', string: ',' })
        }

        if (encodedValue === OBJECT) {
          stack.push(createStackFrame(value as object, parent, options))
          stack.push({ type: 'raw', string: `${JSON.stringify(key)}:` })
        } else {
          stack.push({
            type: 'raw',
            string: `${JSON.stringify(key)}:${encodedValue}`,
          })
        }
      }
    } else {
      result += frame.string
    }
  }

  return result
}

/**
 * Encodes a LexValue into either a JSON string (for primitives) or
 * a JSON-compatible object/array (for complex types).
 * Special Lex types (Cid, Uint8Array) are converted to their JSON representation.
 */
function encodePrimitive(
  value: unknown,
  parent?: ParentRef,
): string | typeof OMIT | typeof OBJECT {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      return OBJECT
    case 'string':
    case 'number':
    case 'boolean':
      return JSON.stringify(value)
    case 'undefined':
      return OMIT
    default:
      throw new TypeError(
        `Unsupported type: ${typeof value} at ${stringifyPath(parent)}`,
      )
  }
}
