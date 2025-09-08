import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import { dataToCborBlock } from '@atproto/common'
import { LexValue, lexToIpld } from '@atproto/lexicon'

export class BlockMap implements Iterable<[cid: CID, bytes: Uint8Array]> {
  private map: Map<string, Uint8Array> = new Map()

  constructor(entries?: Iterable<readonly [cid: CID, bytes: Uint8Array]>) {
    if (entries) {
      for (const [cid, bytes] of entries) {
        this.set(cid, bytes)
      }
    }
  }

  async add(value: LexValue): Promise<CID> {
    const block = await dataToCborBlock(lexToIpld(value))
    this.set(block.cid, block.bytes)
    return block.cid
  }

  set(cid: CID, bytes: Uint8Array): BlockMap {
    this.map.set(cid.toString(), bytes)
    return this
  }

  get(cid: CID): Uint8Array | undefined {
    return this.map.get(cid.toString())
  }

  delete(cid: CID): BlockMap {
    this.map.delete(cid.toString())
    return this
  }

  getMany(cids: CID[]): { blocks: BlockMap; missing: CID[] } {
    const missing: CID[] = []
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

  has(cid: CID): boolean {
    return this.map.has(cid.toString())
  }

  clear(): void {
    this.map.clear()
  }

  forEach(cb: (bytes: Uint8Array, cid: CID) => void): void {
    for (const [cid, bytes] of this) cb(bytes, cid)
  }

  entries(): Entry[] {
    return Array.from(this, toEntry)
  }

  cids(): CID[] {
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
      if (!uint8arrays.equals(bytes, otherBytes)) {
        return false
      }
    }
    return true
  }

  *keys(): Generator<CID, void, unknown> {
    for (const key of this.map.keys()) {
      yield CID.parse(key)
    }
  }

  *values(): Generator<Uint8Array, void, unknown> {
    yield* this.map.values()
  }

  *[Symbol.iterator](): Generator<[CID, Uint8Array], void, unknown> {
    for (const [key, value] of this.map) {
      yield [CID.parse(key), value]
    }
  }
}

function toEntry([cid, bytes]: readonly [CID, Uint8Array]): Entry {
  return { cid, bytes }
}

type Entry = {
  cid: CID
  bytes: Uint8Array
}

export default BlockMap
