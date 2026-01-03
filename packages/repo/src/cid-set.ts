import { Cid, parseCid } from '@atproto/lex-data'

export class CidSet {
  private set: Set<string>

  constructor(arr: Cid[] = []) {
    const strArr = arr.map((c) => c.toString())
    this.set = new Set(strArr)
  }

  add(cid: Cid): CidSet {
    this.set.add(cid.toString())
    return this
  }

  addSet(toMerge: CidSet): CidSet {
    toMerge.toList().map((c) => this.add(c))
    return this
  }

  subtractSet(toSubtract: CidSet): CidSet {
    toSubtract.toList().map((c) => this.delete(c))
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
    return [...this.set].map((c) => parseCid(c))
  }
}

export default CidSet
