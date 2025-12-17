/**
 * Checks whether the input is an object (not null).
 */
export function isObject(input: unknown): input is object {
  return input != null && typeof input === 'object'
}

const ObjectProto = Object.prototype
const ObjectToString = Object.prototype.toString

/**
 * Checks whether the input is an object (not null) whose prototype is either
 * null or `Object.prototype`.
 */
export function isPlainObject(input: unknown) {
  return isObject(input) && isPlainProto(input)
}

/**
 * Checks whether the prototype of the input object is either null or
 * `Object.prototype`.
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
