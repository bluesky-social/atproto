export function minIdx(a: number, b: number): number {
  if (a === -1) return b
  if (b === -1) return a
  return Math.min(a, b)
}

export function toRecord<V extends string | number | boolean>(
  iterable: Iterable<[key: string, value: V]>,
): Record<string, [V, ...V[]]> {
  const record: Record<string, [V, ...V[]]> = Object.create(null)
  for (const [key, value] of iterable) {
    if (Object.hasOwn(record, key)) {
      record[key]!.push(value)
    } else {
      record[key] = [value]
    }
  }
  return record
}

export function sum(a: number, b: number): number {
  return a + b
}

export function knownValuesValidator<T>(values: Iterable<T>) {
  const set = new Set<unknown>(values)
  return (value: unknown): value is T => set.has(value)
}

export function isNonNullable<X>(x: X): x is NonNullable<X> {
  return x != null
}
