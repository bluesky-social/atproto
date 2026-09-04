import type { Cid } from '@atproto/lex-data'

export class CidSet<TCid extends Cid = Cid> implements Iterable<TCid> {
  private map = new Map<string, TCid>()

  constructor(arr: Iterable<TCid> = []) {
    for (const c of arr) {
      this.map.set(c.toString(), c)
    }
  }

  add(cid: TCid): this {
    this.map.set(cid.toString(), cid)
    return this
  }

  addSet(toMerge: CidSet<TCid>): this {
    for (const c of toMerge) this.map.set(c.toString(), c)
    return this
  }

  subtractSet(toSubtract: CidSet<TCid>): this {
    for (const c of toSubtract) this.map.delete(c.toString())
    return this
  }

  delete(cid: TCid): this {
    this.map.delete(cid.toString())
    return this
  }

  has(cid: TCid): boolean {
    return this.map.has(cid.toString())
  }

  size(): number {
    return this.map.size
  }

  clear(): this {
    this.map.clear()
    return this
  }

  toList(): TCid[] {
    return Array.from(this)
  }

  [Symbol.iterator](): MapIterator<TCid> {
    return this.map.values()
  }
}

export default CidSet
