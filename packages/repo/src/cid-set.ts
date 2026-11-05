import type { Cid } from '@atproto/lex-data'

export class CidSet<TCid extends Cid = Cid> implements Iterable<TCid> {
  #map: Map<string, TCid>

  constructor(arr?: Iterable<TCid>) {
    if (arr instanceof CidSet) {
      // Optimized special case for when the input is another CidSet
      this.#map = new Map(arr.#map)
    } else {
      this.#map = new Map()
      if (arr) for (const c of arr) this.#map.set(c.toString(), c)
    }
  }

  add(cid: TCid): this {
    this.#map.set(cid.toString(), cid)
    return this
  }

  addSet(toMerge: CidSet<TCid>): this {
    for (const [k, v] of toMerge.#map) this.#map.set(k, v)
    return this
  }

  subtractSet(toSubtract: CidSet<TCid>): this {
    for (const c of toSubtract.#map.keys()) this.#map.delete(c)
    return this
  }

  delete(cid: TCid): this {
    this.#map.delete(cid.toString())
    return this
  }

  has(cid: TCid): boolean {
    return this.#map.has(cid.toString())
  }

  get size(): number {
    return this.#map.size
  }

  clear(): this {
    this.#map.clear()
    return this
  }

  /** @deprecated Use the iterable interface instead */
  toList(): TCid[] {
    return Array.from(this)
  }

  [Symbol.iterator](): MapIterator<TCid> {
    return this.#map.values()
  }
}

export default CidSet
