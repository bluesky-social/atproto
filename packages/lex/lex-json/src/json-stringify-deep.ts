import type { JsonValue } from './json.js'
import {
  Stack,
  type StackOptions,
  isArrayFrame,
  isObjectFrame,
} from './lib/stack.js'

const OMIT = Symbol('OMIT')
const NESTED = Symbol('NESTED')

const OPEN_BRACKET = '['
const OPEN_BRACE = '{'

export type JsonStringifyDeepOptions = Required<StackOptions> & {
  /**
   * AT Protocol spec does not allow numbers outside of the safe integer range
   * (-(2^53 - 1) to 2^53 - 1)). This options allows to disable the check for
   * safe integers, which can be useful for processing data in "non-strict"
   * mode. Note that setting this to `true` will also allow non-safe integers
   * (floats) to be serialized.
   */
  allowNonSafeIntegers: boolean
}

type RawFrame<TString extends string = string> = {
  type: 'raw'
  string: TString
}
function rawFrame<TString extends string>(string: TString): RawFrame<TString> {
  return { type: 'raw', string }
}
function constRawFrame<TString extends string>(
  string: TString,
): Readonly<RawFrame<TString>> {
  return Object.freeze(rawFrame(string))
}

const COMMA_FRAME = constRawFrame(',')
const NULL_FRAME = constRawFrame('null')
const CLOSE_BRACKET_FRAME = constRawFrame(']')
const CLOSE_BRACE_FRAME = constRawFrame('}')

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
  options: JsonStringifyDeepOptions,
): string {
  // Handle primitives and special types at the root level
  const valueJson = toJSON(input)
  const valueEnc = encodePrimitive(valueJson, options)

  if (valueEnc !== NESTED) {
    if (valueEnc === OMIT) {
      // @NOTE That JSON.stringify(undefined) returns undefined (although it is
      // not typed as such in TypeScript, and not valid JSON). We disallow this
      // since it is not a valid JSON value and is likely an error in the input
      // data.
      throw new TypeError('Invalid undefined value')
    }
    return valueEnc
  }

  const stack = Stack.from<RawFrame>(valueJson as object, options)

  // @NOTE bench have shown that concatenating strings is faster than pushing to
  // an array and joining at the end.
  let result = ''

  // The idea of this loop is to move items from the stack to the result string
  // by browsing the input structure with a depth-first traversal. When we
  // encounter an object or array, we push its children onto the stack, (after
  // adding the opening bracket/brace). The stack is a "last-in-first-out"
  // structure, so we push the children in reverse order to ensure they are
  // processed in the correct order.
  for (const frame of stack) {
    if (isArrayFrame(frame)) {
      if (frame.input.length === 0) {
        result += '[]'
        continue
      }

      const { input } = frame // ArrayFrame
      result += OPEN_BRACKET
      stack.push(CLOSE_BRACKET_FRAME)
      for (let index = input.length - 1; index >= 0; index--) {
        // Add a comma between array elements if this is not the first element
        if (index < input.length - 1) {
          stack.push(COMMA_FRAME)
        }

        const valueJson = toJSON(input[index])
        const valueEnc = encodePrimitive(valueJson, options)

        if (valueEnc === NESTED) {
          stack.pushNested(valueJson as object, { frame, index })
        } else if (valueEnc === OMIT) {
          // JSON.stringify replaces undefined/function/symbol values in arrays
          // with null
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
        const valueJson = toJSON(entries[index][1])
        const valueEnc = encodePrimitive(valueJson, options)

        // JSON.stringify will omit properties with undefined/function/symbol
        // values, so we skip them entirely
        if (valueEnc === OMIT) continue

        if (addedCount > 0) stack.push(COMMA_FRAME)
        addedCount++

        const key = entries[index][0]

        if (valueEnc === NESTED) {
          stack.pushNested(valueJson as object, { frame, index })
          stack.push(rawFrame(`${JSON.stringify(key)}:`))
        } else {
          stack.push(rawFrame(`${JSON.stringify(key)}:${valueEnc}`))
        }
      }
    } else {
      // RawFrame: just append the string to the result
      result += frame.string
    }
  }

  return result
}

function toJSON(value: unknown): unknown {
  switch (typeof value) {
    case 'object':
      if (
        value != null &&
        'toJSON' in value &&
        typeof value.toJSON === 'function'
      ) {
        return value.toJSON()
      }
      return value
    default:
      return value
  }
}

/**
 * Encodes a value into either a JSON string (for primitives) or
 * indicates it needs further processing (for complex types).
 * Note: toJSON() should already be applied before calling this function.
 */
function encodePrimitive(
  value: unknown,
  options: JsonStringifyDeepOptions,
): string | typeof OMIT | typeof NESTED {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      // Input is an object or array that needs further processing.
      return NESTED
    case 'number':
      if (Number.isSafeInteger(value)) return String(value)
      if (options.allowNonSafeIntegers) return JSON.stringify(value)
      throw new TypeError(`Invalid number (got ${value})`)
    case 'string':
      return JSON.stringify(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'undefined':
    case 'symbol':
    case 'function':
      // Return sentinel to indicate this property should be omitted
      // (matching JSON.stringify behavior for object properties)
      return OMIT
    default:
      throw new TypeError(`Do not know how to serialize a ${typeof value}`)
  }
}
