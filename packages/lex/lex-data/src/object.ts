export function isObject(input: unknown): input is object {
  return input != null && typeof input === 'object'
}

const ObjectProto = Object.prototype

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
    ObjectProto.toString.call(input) === '[object Object]'
  )
}
