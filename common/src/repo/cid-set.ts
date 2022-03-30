import { CID } from 'multiformats'

export class CidSet {
  private set: Set<string>

  constructor(arr: CID[] = []) {
    const strArr = arr.map((c) => c.toString())
    this.set = new Set(strArr)
  }

  add(cid: CID): CidSet {
    this.set.add(cid.toString())
    return this
  }

  addSet(toMerge: CidSet): CidSet {
    toMerge.toList().map((c) => this.add(c))
    return this
  }

  subtractSet(toSubtract: CidSet): CidSet {
    toSubtract.toList().forEach((cid) => {
      this.set.delete(cid.toString())
    })
    return this
  }

  delete(cid: CID) {
    this.set.delete(cid.toString())
    return this
  }

  has(cid: CID): boolean {
    return this.set.has(cid.toString())
  }

  size(): number {
    return this.set.size
  }

  clear(): CidSet {
    this.set.clear()
    return this
  }

  toList(): CID[] {
    const arr = [...this.set]
    return arr.map((c) => CID.parse(c))
  }
}

export default CidSet
