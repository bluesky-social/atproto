import { encode } from '@atproto/lex-cbor'
import {
  Cid,
  LexValue,
  cidForCbor,
  parseCid,
  ui8Equals,
} from '@atproto/lex-data'

export class BlockMap implements Iterable<[cid: Cid, bytes: Uint8Array]> {
  private map: Map<string, Uint8Array> = new Map()

  constructor(entries?: Iterable<readonly [cid: Cid, bytes: Uint8Array]>) {
    if (entries) {
      for (const [cid, bytes] of entries) {
        this.set(cid, bytes)
      }
    }
  }

  async add(value: LexValue): Promise<Cid> {
    const bytes = encode(value)
    const cid = await cidForCbor(bytes)
    this.set(cid, bytes)
    return cid
  }

  set(cid: Cid, bytes: Uint8Array): BlockMap {
    this.map.set(cid.toString(), bytes)
    return this
  }

  get(cid: Cid): Uint8Array | undefined {
    return this.map.get(cid.toString())
  }

  delete(cid: Cid): BlockMap {
    this.map.delete(cid.toString())
    return this
  }

  getMany(cids: Cid[]): { blocks: BlockMap; missing: Cid[] } {
    const missing: Cid[] = []
    const blocks = new BlockMap()
    for (const cid of cids) {
      const got = this.map.get(cid.toString())
      if (got) {
        blocks.set(cid, got)
      } else {
        missing.push(cid)
      }
    }
    return { blocks, missing }
  }

  has(cid: Cid): boolean {
    return this.map.has(cid.toString())
  }

  clear(): void {
    this.map.clear()
  }

  forEach(cb: (bytes: Uint8Array, cid: Cid) => void): void {
    for (const [cid, bytes] of this) cb(bytes, cid)
  }

  entries(): Entry[] {
    return Array.from(this, toEntry)
  }

  cids(): Cid[] {
    return Array.from(this.keys())
  }

  addMap(toAdd: BlockMap): BlockMap {
    for (const [cid, bytes] of toAdd) this.set(cid, bytes)
    return this
  }

  get size(): number {
    return this.map.size
  }

  get byteSize(): number {
    let size = 0
    for (const bytes of this.values()) size += bytes.length
    return size
  }

  equals(other: BlockMap): boolean {
    if (this.size !== other.size) {
      return false
    }
    for (const [cid, bytes] of this) {
      const otherBytes = other.get(cid)
      if (!otherBytes) return false
      if (!ui8Equals(bytes, otherBytes)) {
        return false
      }
    }
    return true
  }

  *keys(): Generator<Cid, void, unknown> {
    for (const key of this.map.keys()) {
      yield parseCid(key)
    }
  }

  *values(): Generator<Uint8Array, void, unknown> {
    yield* this.map.values()
  }

  *[Symbol.iterator](): Generator<[Cid, Uint8Array], void, unknown> {
    for (const [key, value] of this.map) {
      yield [parseCid(key), value]
    }
  }
}

function toEntry([cid, bytes]: readonly [Cid, Uint8Array]): Entry {
  return { cid, bytes }
}

type Entry = {
  cid: Cid
  bytes: Uint8Array
}

export default BlockMap
