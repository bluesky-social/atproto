/**
 * Aggregates items in an array based on a comparison function and an aggregation function.
 *
 * @param arr - The input array to aggregate.
 * @param cmp - A comparison function that determines if two items belong to the same group.
 * @param agg - An aggregation function that combines items in a group into a single item.
 * @returns An array of aggregated items.
 * @example
 * ```ts
 * const input = [1, 1, 2, 2, 3, 3, 3]
 * const result = arrayAgg(
 *   input,
 *   (a, b) => a === b,
 *   (items) => { value: items[0], sum: items.reduce((sum, item) => sum + item, 0) },
 * )
 * // result is [{ value: 1, sum: 2 }, { value: 2, sum: 4 }, { value: 3, sum: 6 }]
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function arrayAgg<T, O>(
  arr: readonly T[],
  cmp: (a: T, b: T) => boolean,
  agg: (items: [T, ...T[]]) => O,
): O[] {
  if (arr.length === 0) return []

  const groups: [T, ...T[]][] = [[arr[0]]]
  const skipped = Array<undefined | boolean>(arr.length)

  outer: for (let i = 1; i < arr.length; i++) {
    if (skipped[i]) continue
    const item = arr[i]
    for (let j = 0; j < groups.length; j++) {
      if (cmp(item, groups[j][0])) {
        groups[j].push(item)
        skipped[i] = true
        continue outer
      }
    }
    groups.push([item])
  }

  return groups.map(agg)
}
