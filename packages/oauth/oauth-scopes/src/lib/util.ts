export function minIdx(a: number, b: number): number {
  if (a === -1) return b
  if (b === -1) return a
  return Math.min(a, b)
}

export function toRecord(
  iterable: Iterable<[key: string, value: string]>,
): Record<string, [string, ...string[]]> {
  const record: Record<string, [string, ...string[]]> = Object.create(null)
  for (const [key, value] of iterable) {
    if (Object.hasOwn(record, key)) {
      record[key]!.push(value)
    } else {
      record[key] = [value]
    }
  }
  return record
}
