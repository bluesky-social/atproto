import { Cid, isCid } from './cid.js'
import { isPlainObject } from './object.js'

/**
 * Primitive values in the Lexicon data model.
 *
 * Represents the basic scalar types that can appear in AT Protocol data:
 * - `number` - Integer values only (no floats)
 * - `string` - UTF-8 text
 * - `boolean` - true or false
 * - `null` - Explicit null value
 * - `Cid` - Content Identifier (link by hash)
 * - `Uint8Array` - Binary data (bytes)
 *
 * @see {@link LexValue} for the complete recursive value type
 */
export type LexScalar = number | string | boolean | null | Cid | Uint8Array

/**
 * Any valid Lexicon value (recursive type).
 *
 * This is the union of all types that can appear in AT Protocol Lexicon data:
 * - {@link LexScalar} - Primitive values (number, string, boolean, null, Cid, Uint8Array)
 * - `LexValue[]` - Arrays of LexValues
 * - `{ [key: string]?: LexValue }` - Objects with string keys and LexValue values
 *
 * @example
 * ```typescript
 * import type { LexValue } from '@atproto/lex'
 *
 * const scalar: LexValue = 'hello'
 * const array: LexValue = [1, 2, 3]
 * const object: LexValue = { name: 'Alice', age: 30 }
 * ```
 *
 * @see {@link LexScalar} for primitive value types
 * @see {@link LexMap} for object types
 * @see {@link LexArray} for array types
 */
export type LexValue = LexScalar | LexValue[] | { [_ in string]?: LexValue }

/**
 * Object with string keys and LexValue values.
 *
 * Represents a plain object in the Lexicon data model where all values
 * must be valid {@link LexValue} types.
 *
 * @example
 * ```typescript
 * import type { LexMap } from '@atproto/lex'
 *
 * const user: LexMap = {
 *   name: 'Alice',
 *   age: 30,
 *   tags: ['admin', 'user']
 * }
 * ```
 *
 * @see {@link TypedLexMap} for objects with a required `$type` property
 */
export type LexMap = { [_ in string]?: LexValue }

/**
 * Array of {@link LexValue} elements.
 *
 * @example
 * ```typescript
 * import type { LexArray } from '@atproto/lex'
 *
 * const items: LexArray = [1, 'two', { three: 3 }]
 * ```
 */
export type LexArray = LexValue[]

/**
 * Type guard to check if a value is a valid {@link LexMap}.
 *
 * Returns true if the value is a plain object where all values are valid
 * {@link LexValue} types.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid LexMap
 *
 * @example
 * ```typescript
 * import { isLexMap } from '@atproto/lex'
 *
 * if (isLexMap(data)) {
 *   // data is narrowed to LexMap
 *   console.log(Object.keys(data))
 * }
 * ```
 */
export function isLexMap(value: unknown): value is LexMap {
  return isPlainObject(value) && Object.values(value).every(isLexValue)
}

/**
 * Type guard to check if a value is a valid {@link LexArray}.
 *
 * Returns true if the value is an array where all elements are valid
 * {@link LexValue} types.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid LexArray
 *
 * @example
 * ```typescript
 * import { isLexArray } from '@atproto/lex'
 *
 * if (isLexArray(data)) {
 *   // data is narrowed to LexArray
 *   data.forEach(item => console.log(item))
 * }
 * ```
 */
export function isLexArray(value: unknown): value is LexArray {
  return Array.isArray(value) && value.every(isLexValue)
}

/**
 * Type guard to check if a value is a valid {@link LexScalar}.
 *
 * Returns true if the value is one of the primitive Lexicon types:
 * number (integer only), string, boolean, null, Cid, or Uint8Array.
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid LexScalar
 *
 * @example
 * ```typescript
 * import { isLexScalar } from '@atproto/lex'
 *
 * isLexScalar('hello')     // true
 * isLexScalar(42)          // true
 * isLexScalar(3.14)        // false (floats not allowed)
 * isLexScalar([1, 2])      // false (arrays are not scalars)
 * ```
 */
export function isLexScalar(value: unknown): value is LexScalar {
  switch (typeof value) {
    case 'object':
      return value === null || value instanceof Uint8Array || isCid(value)
    case 'string':
    case 'boolean':
      return true
    case 'number':
      if (Number.isInteger(value)) return true
    // fallthrough
    default:
      return false
  }
}

/**
 * Type guard to check if a value is a valid {@link LexValue}.
 *
 * Performs a deep check to validate that the value (and all nested values)
 * conform to the Lexicon data model. This includes checking for:
 * - Valid scalar types (number, string, boolean, null, Cid, Uint8Array)
 * - Arrays containing only valid LexValues
 * - Plain objects with string keys and valid LexValue values
 * - No cyclic references (which cannot be serialized to JSON or CBOR)
 *
 * @param value - The value to check
 * @returns `true` if the value is a valid LexValue
 *
 * @example
 * ```typescript
 * import { isLexValue } from '@atproto/lex'
 *
 * isLexValue({ name: 'Alice', tags: ['admin'] })  // true
 * isLexValue(new Date())                           // false (not a plain object)
 * isLexValue({ fn: () => {} })                     // false (functions not allowed)
 * ```
 */
export function isLexValue(value: unknown): value is LexValue {
  // Using a stack to avoid recursion depth issues.
  const stack: unknown[] = [value]
  // Cyclic structures are not valid LexValues as they cannot be serialized to
  // JSON or CBOR. This also allows us to avoid infinite loops when traversing
  // the structure.
  const visited = new Set<object>()

  do {
    const value = stack.pop()!

    if (isPlainObject(value)) {
      if (visited.has(value)) return false
      visited.add(value)
      stack.push(...Object.values(value))
    } else if (Array.isArray(value)) {
      if (visited.has(value)) return false
      visited.add(value)
      stack.push(...value)
    } else {
      if (!isLexScalar(value)) return false
    }
  } while (stack.length > 0)

  // Optimization: ease GC's work
  visited.clear()

  return true
}

/**
 * A {@link LexMap} with a required `$type` property.
 *
 * Used to represent typed objects in the Lexicon data model, where the
 * `$type` property identifies the Lexicon schema that defines the object's
 * structure.
 *
 * @example
 * ```typescript
 * import type { TypedLexMap } from '@atproto/lex'
 *
 * const post: TypedLexMap = {
 *   $type: 'app.bsky.feed.post',
 *   text: 'Hello world!',
 *   createdAt: '2024-01-01T00:00:00Z'
 * }
 * ```
 *
 * @see {@link isTypedLexMap} to check if a value is a TypedLexMap
 */
export type TypedLexMap<T extends string = string> = LexMap & { $type: T }

/**
 * Type guard to check if a value is a {@link TypedLexMap}.
 *
 * Returns true if the value is a valid {@link LexMap} with a non-empty
 * `$type` string property.
 *
 * @param value - The LexValue to check
 * @returns `true` if the value is a TypedLexMap
 *
 * @example
 * ```typescript
 * import { isTypedLexMap } from '@atproto/lex'
 *
 * const data = { $type: 'app.bsky.feed.post', text: 'Hello' }
 *
 * if (isTypedLexMap(data)) {
 *   console.log(data.$type)  // 'app.bsky.feed.post'
 * }
 * ```
 */
export function isTypedLexMap(value: LexValue): value is TypedLexMap {
  return (
    isLexMap(value) && typeof value.$type === 'string' && value.$type.length > 0
  )
}
