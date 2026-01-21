/*@__NO_SIDE_EFFECTS__*/
export function lazyProperty<
  O extends object,
  const K extends keyof O,
  const V extends O[K],
>(obj: O, key: K, value: V): V {
  Object.defineProperty(obj, key, {
    value,
    writable: false,
    enumerable: false,
    configurable: true,
  })
  return value
}
