export type NestedIterable<V> = V | Iterable<NestedIterable<V>>

export function* stringReplacer(
  source: string,
  searchValue: string,
  replaceValue: string,
): Generator<string, void, undefined> {
  let previousIndex = 0
  let index = source.indexOf(searchValue)
  while (index !== -1) {
    yield source.slice(previousIndex, index)
    yield replaceValue
    previousIndex = index + searchValue.length
    index = source.indexOf(searchValue, previousIndex)
  }
  yield source.slice(previousIndex)
}
