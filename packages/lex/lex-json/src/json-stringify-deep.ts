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
  const rootEncoded = encodePrimitive(input)
  if (rootEncoded !== undefined) {
    return rootEncoded
  }

  // For objects and arrays, use iterative approach
  const options: StackFrameOptions = {
    maxDepth,
    maxArrayLength,
    maxObjectEntries,
  }

  const rootFrame = createStackFrame(input as any, undefined, options)
  const stack: StackEntry[] = [{ state: 'start', frame: rootFrame, index: 0 }]

  let result = ''
  while (stack.length > 0) {
    const entry = stack.pop()!

    if (entry.state === 'start') {
      if (entry.frame.type === 'array') {
        result += '['
        // If array is empty, close it immediately
        if (entry.frame.input.length === 0) {
          result += ']'
        } else {
          stack.push({ state: 'processing', frame: entry.frame, index: 0 })
        }
      } else {
        result += '{'
        // If object has no entries, close it immediately
        if (entry.frame.entries.length === 0) {
          result += '}'
        } else {
          stack.push({ state: 'processing', frame: entry.frame, index: 0 })
        }
      }
    } else {
      // state === 'processing'
      if (entry.frame.type === 'array') {
        const frame = entry.frame
        const idx = entry.index

        if (idx >= frame.input.length) {
          result += ']'
          continue
        }

        if (idx > 0) {
          result += ','
        }

        const parent: ParentRef = { frame, index: idx }
        const element = frame.input[idx]
        const encoded = encodePrimitive(element, parent)

        if (encoded !== undefined) {
          result += encoded
          stack.push({ state: 'processing', frame, index: idx + 1 })
        } else {
          // Push back the current frame to continue after child
          stack.push({ state: 'processing', frame, index: idx + 1 })
          // Push child frame to process
          const childFrame = createStackFrame(element as any, parent, options)
          stack.push({ state: 'start', frame: childFrame, index: 0 })
        }
      } else {
        const frame = entry.frame
        const idx = entry.index

        if (idx >= frame.entries.length) {
          result += '}'
          continue
        }

        if (idx > 0) {
          result += ','
        }

        const [key, value] = frame.entries[idx]
        result += JSON.stringify(key) + ':'

        const parent: ParentRef = { frame, index: idx }
        const encoded = encodePrimitive(value, parent)

        if (encoded !== undefined) {
          result += encoded
          stack.push({ state: 'processing', frame, index: idx + 1 })
        } else {
          // Push back the current frame to continue after child
          stack.push({ state: 'processing', frame, index: idx + 1 })
          // Push child frame to process
          const childFrame = createStackFrame(value as any, parent, options)
          stack.push({ state: 'start', frame: childFrame, index: 0 })
        }
      }
    }
  }

  return result
}

type StackEntry =
  | { state: 'start'; frame: StackFrame; index: number }
  | { state: 'processing'; frame: StackFrame; index: number }

/**
 * Encodes a LexValue into either a JSON string (for primitives) or
 * a JSON-compatible object/array (for complex types).
 * Special Lex types (Cid, Uint8Array) are converted to their JSON representation.
 */
function encodePrimitive(
  value: unknown,
  parent?: ParentRef,
): string | undefined {
  switch (typeof value) {
    case 'object':
      if (value === null) return 'null'
      return undefined
    case 'string':
    case 'number':
    case 'boolean':
      return JSON.stringify(value)
    default:
      throw new TypeError(
        `Unsupported type: ${typeof value} at ${stringifyPath(parent)}`,
      )
  }
}
