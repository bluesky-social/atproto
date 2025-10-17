/**
 * Same as {@link string} but prevents TypeScript allowing union types to
 * be widened to `string` in IDEs.
 */
export type UnknownString = string & NonNullable<unknown>

export type Primitive = string | number | bigint | boolean | null | undefined
export function isPrimitive(input: unknown): input is Primitive {
  switch (typeof input) {
    case 'string':
    case 'number':
    case 'bigint':
    case 'boolean':
    case 'undefined':
      return true
    case 'object':
      return input === null
    default:
      return false
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

export type PropertyKey = string | number

// @NOTE there is no way to express "array containing at least one P", so we use
// "array that contains P at first or last position" as a workaround.
export type ArrayContaining<T, Items = unknown> =
  | readonly [T, ...Items[]]
  | readonly [...Items[], T]

export function isArray<T>(
  input: unknown,
  itemAssertion: (v: unknown, i: number, a: unknown[]) => v is T,
): input is T[]
export function isArray(
  input: unknown,
  itemAssertion?: (v: unknown, i: number, a: unknown[]) => boolean,
): input is unknown[]
export function isArray(
  input: unknown,
  itemAssertion?: (v: unknown, i: number, a: unknown[]) => boolean,
): input is unknown[] {
  return Array.isArray(input) && (!itemAssertion || input.every(itemAssertion))
}

export function isArrayLike(input: unknown): input is ArrayLike<unknown> {
  return (
    input instanceof ArrayBuffer ||
    ArrayBuffer.isView(input) ||
    isArrayLikeObject(input) ||
    isArray(input)
  )
}

export function isPureObject(
  input: unknown,
): input is object & Record<string, unknown> {
  if (!isObject(input)) return false
  const proto = Object.getPrototypeOf(input)
  return proto === null || proto === Object.prototype
}

export function isArrayLikeObject(input: unknown): input is ArrayLike<unknown> {
  if (!isPureObject(input)) return false
  if (!('length' in input)) return false
  const { length } = input
  if (
    typeof length !== 'number' ||
    length < 0 ||
    !Number.isInteger(length) ||
    // Prevent memory exhaustion: Array.from({ length: 1e9 })
    length > 100_000
  ) {
    return false
  }

  for (const index in input) {
    if (!/^\d+$/.test(index)) return false
    const i = Number(index)
    if (i < 0 || i >= length) return false
  }

  return true
}

export function isObject(input: unknown): input is object {
  return input != null && typeof input === 'object'
}

export function hasOwn<T extends object, K extends PropertyKey>(
  obj: T,
  key: K,
): obj is T & Record<K, unknown> {
  return Object.hasOwn(obj, key)
}

export function isIterableObject(
  obj: unknown,
): obj is object & Iterable<unknown> {
  return (
    isObject(obj) &&
    Symbol.iterator in obj &&
    typeof obj[Symbol.iterator] === 'function'
  )
}

export function isAsyncIterableObject(
  obj: unknown,
): obj is object & AsyncIterable<unknown> {
  return (
    isObject(obj) &&
    Symbol.asyncIterator in obj &&
    typeof obj[Symbol.asyncIterator] === 'function'
  )
}

/**
 * Simple wrapper around {@link Number.isInteger} that acts as a type guard.
 */
export function isInteger(input: unknown): input is number {
  return Number.isInteger(input)
}
