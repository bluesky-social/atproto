export function keyBy<T, K extends keyof T>(
  arr: readonly T[],
  key: K,
): Map<T[K], T> {
  return arr.reduce((acc, cur) => {
    acc.set(cur[key], cur)
    return acc
  }, new Map<T[K], T>())
}

export const mapDefined = <T, S>(
  arr: T[],
  fn: (obj: T) => S | undefined,
): S[] => {
  const output: S[] = []
  for (const item of arr) {
    const val = fn(item)
    if (val !== undefined) {
      output.push(val)
    }
  }
  return output
}
