import { NSID } from '@atproto/syntax'

/**
 * A Map implementation that maps keys of type K to an internal representation I.
 *
 * Key identity is determined by the {@link Object.is} comparison of the
 * encoded keys. This is useful for complex key types that can be serialized
 * to a unique primitive representation (typically strings).
 *
 * @typeParam K - The external key type
 * @typeParam V - The value type stored in the map
 * @typeParam I - The internal encoded key type used for identity comparison
 */
class MappedMap<K, V, I = any> implements Map<K, V> {
  private map = new Map<I, V>()

  /**
   * Creates a new MappedMap with custom key encoding/decoding functions.
   *
   * @param encodeKey - Function to convert external keys to internal representation
   * @param decodeKey - Function to convert internal representation back to external keys
   */
  constructor(
    private readonly encodeKey: (key: K) => I,
    private readonly decodeKey: (enc: I) => K,
  ) {}

  get size(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  set(key: K, value: V): this {
    this.map.set(this.encodeKey(key), value)
    return this
  }

  get(key: K): V | undefined {
    return this.map.get(this.encodeKey(key))
  }

  has(key: K): boolean {
    return this.map.has(this.encodeKey(key))
  }

  delete(key: K): boolean {
    return this.map.delete(this.encodeKey(key))
  }

  values(): IterableIterator<V> {
    return this.map.values()
  }

  *keys(): IterableIterator<K> {
    for (const key of this.map.keys()) {
      yield this.decodeKey(key)
    }
  }

  *entries(): IterableIterator<[K, V]> {
    for (const [key, value] of this.map.entries()) {
      yield [this.decodeKey(key), value]
    }
  }

  forEach(
    callbackfn: (value: V, key: K, map: MappedMap<K, V>) => void,
    thisArg?: any,
  ): void {
    for (const [key, value] of this) {
      callbackfn.call(thisArg, value, key, this)
    }
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries()
  }

  [Symbol.toStringTag]: string = 'MappedMap'
}

/**
 * A Map specialized for using NSID (Namespaced Identifier) values as keys.
 *
 * NSIDs are compared by their string representation, allowing different
 * NSID object instances with the same value to be treated as the same key.
 *
 * @typeParam T - The value type stored in the map
 *
 * @example
 * ```typescript
 * import { NsidMap } from '@atproto/lex-installer'
 * import { NSID } from '@atproto/syntax'
 * import { LexiconDocument } from '@atproto/lex-document'
 *
 * const lexicons = new NsidMap<LexiconDocument>()
 *
 * // Store lexicon documents by NSID
 * lexicons.set(NSID.from('app.bsky.feed.post'), postLexicon)
 * lexicons.set(NSID.from('app.bsky.actor.profile'), profileLexicon)
 *
 * // Retrieve by NSID (different object instance works)
 * const doc = lexicons.get(NSID.from('app.bsky.feed.post'))
 *
 * // Iterate over entries
 * for (const [nsid, lexicon] of lexicons) {
 *   console.log(`${nsid}: ${lexicon.description}`)
 * }
 * ```
 */
export class NsidMap<T> extends MappedMap<NSID, T, string> {
  /**
   * Creates a new empty NsidMap.
   */
  constructor() {
    super(
      (key) => key.toString(),
      (enc) => NSID.from(enc),
    )
  }
}
