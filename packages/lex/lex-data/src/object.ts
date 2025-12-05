export function isObject(input: unknown): input is object {
  return input != null && typeof input === 'object'
}

const ObjectProto = Object.prototype
const ObjectToString = Object.prototype.toString

export function isPlainObject(
  input: unknown,
): input is object & Record<string, unknown> {
  if (!input || typeof input !== 'object') return false
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
