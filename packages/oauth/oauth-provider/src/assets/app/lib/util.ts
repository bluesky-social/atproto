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
