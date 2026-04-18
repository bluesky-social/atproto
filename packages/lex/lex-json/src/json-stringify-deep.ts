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

type StringFrame = {
  type: 'string'
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
  const value = applyToJSON(input)
  const encoded = encodePrimitive(value)
  if (encoded === OMIT) {
    // @NOTE That JSON.stringify(undefined) returns undefined (although it is
    // not typed as such in TypeScript, and not valid JSON). We disallow this
    // since it is not a valid JSON value and is likely an error in the input
    // data.
    throw new TypeError('Invalid undefined value at $')
  }
  if (encoded !== OBJECT) {
    return encoded
  }

  // For objects and arrays, use iterative approach
  const options: StackFrameOptions = {
    maxDepth,
    maxArrayLength,
    maxObjectEntries,
  }

  const frame = createStackFrame(value as object, undefined, options)
  const stack: (StackFrame | StringFrame)[] = [frame]

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
      stack.push({ type: 'string', string: ']' })
      for (let index = input.length - 1; index >= 0; index--) {
        const parent: ParentRef = { frame, index }

        const value = applyToJSON(input[index])
        const encoded = encodePrimitive(value, parent)

        if (index < input.length - 1) {
          stack.push({ type: 'string', string: ',' })
        }

        if (encoded === OBJECT) {
          stack.push(createStackFrame(value as object, parent, options))
        } else if (encoded === OMIT) {
          // JSON.stringify replaces undefined values in arrays with null
          stack.push({ type: 'string', string: 'null' })
        } else {
          stack.push({ type: 'string', string: encoded })
        }
      }
    } else if (frame.type === 'object') {
      const { entries } = frame

      if (entries.length === 0) {
        result += '{}'
        continue
      }

      result += '{'
      stack.push({ type: 'string', string: '}' })

      // Process entries and track if we've added any (for comma placement)
      let addedCount = 0
      for (let index = entries.length - 1; index >= 0; index--) {
        const parent: ParentRef = { frame, index }

        const value = applyToJSON(entries[index][1])
        const encoded = encodePrimitive(value, parent)

        if (encoded === OMIT) {
          // Omit this property (undefined values should be removed)
          continue
        }

        if (addedCount > 0) {
          stack.push({ type: 'string', string: ',' })
        }
        addedCount++

        const key = entries[index][0]

        if (encoded === OBJECT) {
          stack.push(createStackFrame(value as object, parent, options))
          stack.push({ type: 'string', string: `${JSON.stringify(key)}:` })
        } else {
          stack.push({
            type: 'string',
            string: `${JSON.stringify(key)}:${encoded}`,
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
 * Applies toJSON() transformation once if the value has one.
 * Note: JSON.stringify only calls toJSON once per serialization step, not recursively.
 */
function applyToJSON(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    'toJSON' in value &&
    typeof value.toJSON === 'function'
  ) {
    return value.toJSON()
  }
  return value
}

/**
 * Encodes a value into either a JSON string (for primitives) or
 * indicates it needs further processing (for complex types).
 * Note: toJSON() should already be applied before calling this function.
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
    case 'function':
      // JSON.stringify omits undefined and function values
      return OMIT
    default:
      throw new TypeError(
        `Unsupported type: ${typeof value} at ${stringifyPath(parent)}`,
      )
  }
}
