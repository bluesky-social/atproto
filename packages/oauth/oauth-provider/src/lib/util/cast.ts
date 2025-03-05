export const ifString = <V>(v: V) => (typeof v === 'string' ? v : undefined)

export function asArray<T>(value: T | T[]): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}
