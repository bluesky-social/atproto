/**
 * GENERATED CODE - DO NOT MODIFY
 */
export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function hasProp<O extends object, K extends PropertyKey>(
  data: O,
  prop: K,
): data is O & Record<K, unknown> {
  return prop in data
}
