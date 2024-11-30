export function upsert<T>(
  arr: readonly T[],
  item: T,
  predicate: (value: T, index: number, obj: readonly T[]) => boolean,
): T[] {
  const idx = arr.findIndex(predicate)
  return idx === -1
    ? [...arr, item]
    : [...arr.slice(0, idx), item, ...arr.slice(idx + 1)]
}

export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>
export type Override<T, U> = Simplify<Omit<T, keyof U> & U>
