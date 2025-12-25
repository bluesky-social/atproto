import { NSID } from '@atproto/syntax'

/**
 * A Set implementation that maps values of type K to an internal representation
 * I. Value identity is determined by the {@link Object.is} comparison of the
 * encoded values.
 *
 * This is typically useful for values that can be serialized to a unique string
 * representation.
 */
export class MappedSet<K, I = any> implements Set<K> {
  private set = new Set<I>()

  constructor(
    private readonly encodeValue: (val: K) => I,
    private readonly decodeValue: (enc: I) => K,
  ) {}

  get size(): number {
    return this.set.size
  }

  clear(): void {
    this.set.clear()
  }

  add(val: K): this {
    this.set.add(this.encodeValue(val))
    return this
  }

  has(val: K): boolean {
    return this.set.has(this.encodeValue(val))
  }

  delete(val: K): boolean {
    return this.set.delete(this.encodeValue(val))
  }

  *values(): IterableIterator<K> {
    for (const val of this.set.values()) {
      yield this.decodeValue(val)
    }
  }

  keys(): SetIterator<K> {
    return this.values()
  }

  *entries(): IterableIterator<[K, K]> {
    for (const val of this) yield [val, val]
  }

  forEach(
    callbackfn: (value: K, value2: K, set: Set<K>) => void,
    thisArg?: any,
  ): void {
    for (const val of this) {
      callbackfn.call(thisArg, val, val, this)
    }
  }

  [Symbol.iterator](): IterableIterator<K> {
    return this.values()
  }

  [Symbol.toStringTag]: string = 'MappedSet'
}

export class NsidSet extends MappedSet<NSID, string> {
  constructor() {
    super(
      (val) => val.toString(),
      (enc) => NSID.from(enc),
    )
  }
}
