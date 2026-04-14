/**
 * Checks whether the input is an object (not null).
 *
 * Returns true for any non-null value with typeof 'object', including
 * arrays, plain objects, class instances, etc.
 *
 * @param input - The value to check
 * @returns `true` if the input is an object (not null)
 *
 * @example
 * ```typescript
 * import { isObject } from '@atproto/lex-data'
 *
 * isObject({})           // true
 * isObject([1, 2, 3])    // true
 * isObject(new Date())   // true
 * isObject(null)         // false
 * isObject('string')     // false
 * ```
 */
export function isObject(input: unknown): input is object {
  return input != null && typeof input === 'object'
}

const ObjectProto = Object.prototype
const ObjectToString = Object.prototype.toString

/**
 * Checks whether the input is a plain object.
 *
 * A plain object is an object (not null) whose prototype is either null
 * or `Object.prototype`. This excludes arrays, class instances, and other
 * special objects.
 *
 * @param input - The value to check
 * @returns `true` if the input is a plain object
 *
 * @example
 * ```typescript
 * import { isPlainObject } from '@atproto/lex-data'
 *
 * isPlainObject({})                    // true
 * isPlainObject({ a: 1 })              // true
 * isPlainObject(Object.create(null))   // true
 * isPlainObject([1, 2, 3])             // false
 * isPlainObject(new Date())            // false
 * isPlainObject(null)                  // false
 * ```
 */
export function isPlainObject(input: unknown) {
  return isObject(input) && isPlainProto(input)
}

/**
 * Checks whether the prototype of an object is plain (null or Object.prototype).
 *
 * This is useful for checking if an object is a plain object without
 * checking that it's non-null first (the null check is already done).
 *
 * @param input - The object to check (must be non-null)
 * @returns `true` if the object's prototype is plain
 *
 * @example
 * ```typescript
 * import { isPlainProto } from '@atproto/lex-data'
 *
 * isPlainProto({})                    // true
 * isPlainProto(Object.create(null))   // true
 * isPlainProto([1, 2, 3])             // false (Array.prototype)
 * isPlainProto(new Date())            // false (Date.prototype)
 * ```
 */
export function isPlainProto(input: object): input is Record<string, unknown> {
  const proto = Object.getPrototypeOf(input)
  if (proto === null) return true
  return (
    (proto === ObjectProto ||
      // Needed to support NodeJS's `runInNewContext` which produces objects
      // with a different prototype
      Object.getPrototypeOf(proto) === null) &&
    ObjectToString.call(input) === '[object Object]'
  )
}
