import { CID } from 'multiformats'

export class CidSet implements Iterable<CID> {
  private set: Set<string>

  constructor(it: Iterable<CID> = []) {
    this.set = new Set(Array.from(it, String))
  }

  add(cid: CID): this {
    this.set.add(cid.toString())
    return this
  }

  addSet(toMerge: CidSet): this {
    for (const cid of toMerge) this.add(cid)
    return this
  }

  subtractSet(toSubtract: CidSet): this {
    for (const cid of toSubtract) this.delete(cid)
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

  clear(): this {
    this.set.clear()
    return this
  }

  toList(): CID[] {
    return Array.from(this)
  }

  *[Symbol.iterator](): Generator<CID, void, unknown> {
    for (const cidStr of this.set) {
      yield CID.parse(cidStr)
    }
  }
}

export default CidSet
