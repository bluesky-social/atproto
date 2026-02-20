interface TypeofMap {
  string: string
  number: number
  boolean: boolean
  symbol: symbol
  object: object
  undefined: undefined
  bigint: bigint
  // eslint-disable-next-line @typescript-eslint/ban-types
  function: Function
}

type TypeofToType<T extends keyof TypeofMap> = TypeofMap[T]

export function hasPropOfType<
  O extends object,
  K extends PropertyKey,
  T extends keyof TypeofMap,
>(obj: O, prop: K, type: T): obj is O & Record<K, TypeofToType<T>> {
  return prop in obj && typeof (obj as Record<K, unknown>)[prop] === type
}
