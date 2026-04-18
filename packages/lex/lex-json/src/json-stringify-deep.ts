import { JsonValue } from './json.js'
import {
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_NESTING_FACTOR,
  MAX_OBJECT_ENTRIES,
  type ParentRef,
  Stack,
  StackOptions,
  stringifyPath,
} from './lib/stack.js'

const OMIT = Symbol('OMIT')
const OBJECT = Symbol('object')

export type JsonStringifyDeepOptions = Partial<StackOptions> &
  Partial<EncodePrimitiveOptions>

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
    allowNonInteger = false,
    maxNestingFactor = MAX_NESTING_FACTOR,
    maxDepth = MAX_DEPTH,
    maxArrayLength = MAX_ARRAY_LENGTH,
    maxObjectEntries = MAX_OBJECT_ENTRIES,
  }: JsonStringifyDeepOptions = {},
): string {
  const options: EncodePrimitiveOptions = { allowNonInteger }

  // Handle primitives and special types at the root level
  const value = applyToJSON(input)
  const encoded = encodePrimitive(value, options)
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

  const stack = new Stack<StringFrame>(value as object, {
    maxNestingFactor,
    maxDepth,
    maxArrayLength,
    maxObjectEntries,
  })

  let result = ''
  for (const frame of stack) {
    if (frame.type === 'array') {
      if (frame.input.length === 0) {
        result += '[]'
        continue
      }

      const { input } = frame // ArrayFrame
      result += '['
      stack.pushCustom({ type: 'string', string: ']' })
      for (let index = input.length - 1; index >= 0; index--) {
        const parent: ParentRef = { frame, index }

        const value = applyToJSON(input[index])
        const encoded = encodePrimitive(value, options, parent)

        if (index < input.length - 1) {
          stack.pushCustom({ type: 'string', string: ',' })
        }

        if (encoded === OBJECT) {
          stack.pushObject(value as object, parent)
        } else if (encoded === OMIT) {
          // JSON.stringify replaces undefined values in arrays with null
          stack.pushCustom({ type: 'string', string: 'null' })
        } else {
          stack.pushCustom({ type: 'string', string: encoded })
        }
      }
    } else if (frame.type === 'object') {
      const { entries } = frame // ObjectFrame

      if (entries.length === 0) {
        result += '{}'
        continue
      }

      result += '{'
      stack.pushCustom({ type: 'string', string: '}' })

      // Process entries and track if we've added any (for comma placement)
      let addedCount = 0
      for (let index = entries.length - 1; index >= 0; index--) {
        const parent: ParentRef = { frame, index }

        const value = applyToJSON(entries[index][1])
        const encoded = encodePrimitive(value, options, parent)

        if (encoded === OMIT) {
          // Omit this property (undefined values should be removed)
          continue
        }

        if (addedCount > 0) {
          stack.pushCustom({ type: 'string', string: ',' })
        }
        addedCount++

        const key = entries[index][0]

        if (encoded === OBJECT) {
          stack.pushObject(value as object, parent)
          stack.pushCustom({
            type: 'string',
            string: `${JSON.stringify(key)}:`,
          })
        } else {
          stack.pushCustom({
            type: 'string',
            string: `${JSON.stringify(key)}:${encoded}`,
          })
        }
      }
    } else {
      // StringFrame: just append the string to the result
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

type EncodePrimitiveOptions = {
  allowNonInteger: boolean
}

/**
 * Encodes a value into either a JSON string (for primitives) or
 * indicates it needs further processing (for complex types).
 * Note: toJSON() should already be applied before calling this function.
 */
function encodePrimitive(
  value: unknown,
  options: EncodePrimitiveOptions,
  parent?: ParentRef,
): string | typeof OMIT | typeof OBJECT {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      return OBJECT
    case 'number':
      if (options.allowNonInteger) return JSON.stringify(value)
      if (Number.isSafeInteger(value)) return JSON.stringify(value)
      throw new TypeError(
        `Invalid number (got ${value}) at ${stringifyPath(parent)}`,
      )
    case 'string':
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
