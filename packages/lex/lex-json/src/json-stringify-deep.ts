import { JsonValue } from './json.js'
import {
  Stack,
  StackOptions,
  isArrayFrame,
  isObjectFrame,
} from './lib/stack.js'

const OMIT = Symbol('OMIT')
const OBJECT = Symbol('object')

const OPEN_BRACKET = '['
const OPEN_BRACE = '{'

export type JsonStringifyDeepOptions = StackOptions & EncodePrimitiveOptions

type RawFrame = { type: 'raw'; string: string }
function rawFrame(string: string): RawFrame {
  return { type: 'raw', string }
}

const COMMA_FRAME = Object.freeze(rawFrame(','))
const NULL_FRAME = Object.freeze(rawFrame('null'))
const CLOSE_BRACKET_FRAME = Object.freeze(rawFrame(']'))
const CLOSE_BRACE_FRAME = Object.freeze(rawFrame('}'))

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
  // Handle primitives and special types at the root level
  const valueJson = hasToJSON(input) ? input.toJSON() : input
  const valueEnc = encodePrimitive(valueJson, options)

  if (valueEnc !== OBJECT) {
    if (valueEnc === OMIT) {
      // @NOTE That JSON.stringify(undefined) returns undefined (although it is
      // not typed as such in TypeScript, and not valid JSON). We disallow this
      // since it is not a valid JSON value and is likely an error in the input
      // data.
      throw new TypeError('Invalid undefined value')
    }
    return valueEnc
  }

  const stack = new Stack<RawFrame>(valueJson as object, options)

  let result = ''

  // The idea of this loop is to move items from the stack to the result string.
  // When we encounter an object or array, we push its children onto the stack,
  // (after adding the opening bracket/brace). The stack is a
  // "last-in-first-out" structure, so we push the children in reverse order to
  // ensure they are processed in the correct order.
  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    if (isArrayFrame(frame)) {
      if (frame.input.length === 0) {
        result += '[]'
        continue
      }

      const { input } = frame // ArrayFrame
      result += OPEN_BRACKET
      stack.push(CLOSE_BRACKET_FRAME)
      for (let index = input.length - 1; index >= 0; index--) {
        const value = input[index]
        const valueJson = hasToJSON(value) ? value.toJSON() : value
        const valueEnc = encodePrimitive(valueJson, options)

        if (index < input.length - 1) {
          stack.push(COMMA_FRAME)
        }

        if (valueEnc === OBJECT) {
          stack.pushNested(valueJson as object, { frame, index })
        } else if (valueEnc === OMIT) {
          // JSON.stringify replaces undefined values in arrays with null
          stack.push(NULL_FRAME)
        } else {
          stack.push(rawFrame(valueEnc))
        }
      }
    } else if (isObjectFrame(frame)) {
      const { entries } = frame

      if (entries.length === 0) {
        result += '{}'
        continue
      }

      result += OPEN_BRACE
      stack.push(CLOSE_BRACE_FRAME)

      // Process entries and track if we've added any (for comma placement)
      let addedCount = 0

      for (let index = entries.length - 1; index >= 0; index--) {
        const value = entries[index][1]
        const valueJson = hasToJSON(value) ? value.toJSON() : value
        const valueEnc = encodePrimitive(valueJson, options)

        // JSON.stringify will omit properties with undefined values, so we
        // skip them entirely
        if (valueEnc === OMIT) continue

        if (addedCount > 0) stack.push(COMMA_FRAME)
        addedCount++

        const key = entries[index][0]

        if (valueEnc === OBJECT) {
          stack.pushNested(valueJson as object, { frame, index })
          stack.push(rawFrame(`${JSON.stringify(key)}:`))
        } else {
          stack.push(rawFrame(`${JSON.stringify(key)}:${valueEnc}`))
        }
      }
    } else {
      // StringFrame: just append the string to the result
      result += frame.string
    }
  }

  return result
}

function hasToJSON(value: unknown): value is { toJSON: () => unknown } {
  return typeof (value as any)?.toJSON === 'function'
}

type EncodePrimitiveOptions = {
  /**
   * AT Protocol spec does not allow numbers outside of the safe integer range
   * (-(2^53 - 1) to 2^53 - 1)). This options allows to disable the check for
   * safe integers, which can be useful for processing data in "non-strict"
   * mode.
   *
   * @default true
   */
  allowNonSafeIntegers?: boolean
}

/**
 * Encodes a value into either a JSON string (for primitives) or
 * indicates it needs further processing (for complex types).
 * Note: toJSON() should already be applied before calling this function.
 */
function encodePrimitive(
  value: unknown,
  options?: EncodePrimitiveOptions,
): string | typeof OMIT | typeof OBJECT {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      return OBJECT
    case 'number':
      if (options?.allowNonSafeIntegers ?? true) return JSON.stringify(value)
      if (Number.isSafeInteger(value)) return JSON.stringify(value)
      throw new TypeError(`Invalid number (got ${value})`)
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'undefined':
    case 'function':
      // JSON.stringify omits undefined and function values
      return OMIT
    default:
      throw new TypeError(`Unsupported type: ${typeof value}`)
  }
}
