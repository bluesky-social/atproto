import { lexToIpld, LexValue } from '@atproto/lexicon'
import { dataToCborBlock } from '@atproto/common'
import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'

export class BlockMap {
  private map: Map<string, Uint8Array> = new Map()

  async add(value: LexValue): Promise<CID> {
    const block = await dataToCborBlock(lexToIpld(value))
    this.set(block.cid, block.bytes)
    return block.cid
  }

  set(cid: CID, bytes: Uint8Array) {
    this.map.set(cid.toString(), bytes)
  }

  get(cid: CID): Uint8Array | undefined {
    return this.map.get(cid.toString())
  }

  delete(cid: CID) {
    this.map.delete(cid.toString())
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
    this.map.forEach((val, key) => cb(val, CID.parse(key)))
  }

  entries(): Entry[] {
    const entries: Entry[] = []
    this.forEach((bytes, cid) => {
      entries.push({ cid, bytes })
    })
    return entries
  }

  cids(): CID[] {
    return this.entries().map((e) => e.cid)
  }

  addMap(toAdd: BlockMap) {
    toAdd.forEach((bytes, cid) => {
      this.set(cid, bytes)
    })
  }

  get size(): number {
    return this.map.size
  }

  get byteSize(): number {
    let size = 0
    this.forEach((bytes) => {
      size += bytes.length
    })
    return size
  }

  equals(other: BlockMap): boolean {
    if (this.size !== other.size) {
      return false
    }
    for (const entry of this.entries()) {
      const otherBytes = other.get(entry.cid)
      if (!otherBytes) return false
      if (!uint8arrays.equals(entry.bytes, otherBytes)) {
        return false
      }
    }
    return true
  }
}

type Entry = {
  cid: CID
  bytes: Uint8Array
}

export default BlockMap
