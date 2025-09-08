import { CID } from 'multiformats/cid'

export class CidMap<T> implements Iterable<[cid: CID, value: T]> {
  private map = new Map<string, T>()

  constructor(entries?: Iterable<readonly [cid: CID, value: T]>) {
    if (entries) this.addMap(entries)
  }

  get size(): number {
    return this.map.size
  }

  set(cid: CID, value: T): this {
    this.map.set(cid.toString(), value)
    return this
  }

  get(cid: CID): T | undefined {
    return this.map.get(cid.toString())
  }

  delete(cid: CID): this {
    this.map.delete(cid.toString())
    return this
  }

  has(cid: CID): boolean {
    return this.map.has(cid.toString())
  }

  clear(): void {
    this.map.clear()
  }

  addMap(toAdd: Iterable<readonly [cid: CID, value: T]>): this {
    if (toAdd instanceof CidMap) {
      // Optimize for constructing from another CidMap (avoids parse + stringify)
      for (const [cidStr, value] of toAdd.map) this.map.set(cidStr, value)
    } else {
      for (const [cid, value] of toAdd) this.set(cid, value)
    }
    return this
  }

  forEach(cb: (value: T, cid: CID) => void, thisArg?: any): void {
    for (const [cid, value] of this) cb.call(thisArg, value, cid)
  }

  *keys(): Generator<CID, void, unknown> {
    for (const key of this.map.keys()) {
      yield CID.parse(key)
    }
  }

  *values(): Generator<T, void, unknown> {
    yield* this.map.values()
  }

  *[Symbol.iterator](): Generator<[CID, T], void, unknown> {
    for (const [key, value] of this.map) {
      yield [CID.parse(key), value] as const
    }
  }
}
