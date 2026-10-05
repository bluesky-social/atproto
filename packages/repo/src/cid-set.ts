import { type Cid, parseCid } from '@atproto/lex-data'
import { VisitedCidError } from './error.js'

export class CidSet implements Iterable<Cid> {
  private set: Set<string>

  constructor(arr: Cid[] = []) {
    const strArr = arr.map((c) => c.toString())
    this.set = new Set(strArr)
  }

  add(cid: Cid): CidSet {
    this.set.add(cid.toString())
    return this
  }

  // Adds `cid` to the set, throwing `VisitedCidError` if it is already present.
  // Prefer this over `has` + `add` so the CID is only stringified once.
  markVisited(cid: Cid): void {
    const str = cid.toString()
    if (this.set.has(str)) throw new VisitedCidError(cid)
    this.set.add(str)
  }

  addSet(toMerge: CidSet): CidSet {
    for (const c of toMerge.set) this.set.add(c)
    return this
  }

  subtractSet(toSubtract: CidSet): CidSet {
    for (const c of toSubtract.set) this.set.delete(c)
    return this
  }

  delete(cid: Cid) {
    this.set.delete(cid.toString())
    return this
  }

  has(cid: Cid): boolean {
    return this.set.has(cid.toString())
  }

  size(): number {
    return this.set.size
  }

  clear(): CidSet {
    this.set.clear()
    return this
  }

  toList(): Cid[] {
    return Array.from(this)
  }

  *[Symbol.iterator](): Generator<Cid, void, unknown> {
    for (const c of this.set) {
      yield parseCid(c)
    }
  }
}

export default CidSet
