export interface Matchable<T> {
  matches(options: T): boolean
}

export function minIdx(a: number, b: number): number {
  if (a === -1) return b
  if (b === -1) return a
  return Math.min(a, b)
}

export function knownValuesValidator<T>(values: Iterable<T>) {
  const set = new Set<unknown>(values)
  return (value: unknown): value is T => set.has(value)
}

export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value != null
}
