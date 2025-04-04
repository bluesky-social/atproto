export function upsert<T>(
  arr: undefined | readonly T[],
  item: T,
  predicate: (value: T, index: number, obj: readonly T[]) => boolean,
): T[] {
  if (!arr) return [item]
  const idx = arr.findIndex(predicate)
  return idx === -1
    ? [...arr, item]
    : [...arr.slice(0, idx), item, ...arr.slice(idx + 1)]
}
