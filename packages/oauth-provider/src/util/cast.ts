export function asArray<T>(value: T | T[]): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}
