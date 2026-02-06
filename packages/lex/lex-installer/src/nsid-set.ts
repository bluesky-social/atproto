import { NSID } from '@atproto/syntax'

/**
 * A Set implementation that maps values of type K to an internal representation I.
 *
 * Value identity is determined by the {@link Object.is} comparison of the
 * encoded values. This is useful for complex types that can be serialized
 * to a unique primitive representation (typically strings).
 *
 * @typeParam K - The external value type stored in the set
 * @typeParam I - The internal encoded type used for identity comparison
 */
export class MappedSet<K, I = any> implements Set<K> {
  private set = new Set<I>()

  /**
   * Creates a new MappedSet with custom encoding/decoding functions.
   *
   * @param encodeValue - Function to convert external values to internal representation
   * @param decodeValue - Function to convert internal representation back to external values
   */
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

/**
 * A Set specialized for storing NSID (Namespaced Identifier) values.
 *
 * NSIDs are compared by their string representation, allowing different
 * NSID object instances with the same value to be treated as equal.
 *
 * @example
 * ```typescript
 * import { NsidSet } from '@atproto/lex-installer'
 * import { NSID } from '@atproto/syntax'
 *
 * const nsidSet = new NsidSet()
 *
 * nsidSet.add(NSID.from('app.bsky.feed.post'))
 * nsidSet.add(NSID.from('app.bsky.actor.profile'))
 *
 * // Check membership
 * nsidSet.has(NSID.from('app.bsky.feed.post')) // true
 *
 * // Iterate over NSIDs
 * for (const nsid of nsidSet) {
 *   console.log(nsid.toString())
 * }
 * ```
 */
export class NsidSet extends MappedSet<NSID, string> {
  /**
   * Creates a new empty NsidSet.
   */
  constructor() {
    super(
      (val) => val.toString(),
      (enc) => NSID.from(enc),
    )
  }
}
