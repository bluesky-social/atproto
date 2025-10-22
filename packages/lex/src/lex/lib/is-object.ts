export function isObject(input: unknown): input is object {
  return input != null && typeof input === 'object'
}

export function isPureObject(
  input: unknown,
): input is object & Record<string, unknown> {
  if (!input || typeof input !== 'object') return false
  const proto = Object.getPrototypeOf(input)
  return proto === Object.prototype || proto === null
}
