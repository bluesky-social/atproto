import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import { dataToCborBlock } from '@atproto/common'
import { LexValue, lexToIpld } from '@atproto/lexicon'
import { CidMap } from './cid-map'

export class BlockMap extends CidMap<Uint8Array> {
  async add(value: LexValue): Promise<CID> {
    const block = await dataToCborBlock(lexToIpld(value))
    this.set(block.cid, block.bytes)
    return block.cid
  }

  getMany(cids: CID[]): { blocks: BlockMap; missing: CID[] } {
    const missing: CID[] = []
    const blocks = new BlockMap()
    for (const cid of cids) {
      const got = this.get(cid)
      if (got) {
        blocks.set(cid, got)
      } else {
        missing.push(cid)
      }
    }
    return { blocks, missing }
  }

  entries(): Entry[] {
    return Array.from(this, toEntry)
  }

  cids(): CID[] {
    return Array.from(this.keys())
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
}

function toEntry([cid, bytes]: readonly [CID, Uint8Array]): Entry {
  return { cid, bytes }
}

type Entry = {
  cid: CID
  bytes: Uint8Array
}

export default BlockMap
