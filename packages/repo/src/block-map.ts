import { valueToIpldBlock } from '@atproto/common'
import { CID } from 'multiformats/cid'

export class BlockMap {
  private map: Map<string, Uint8Array> = new Map()

  async add(value: unknown): Promise<CID> {
    const block = await valueToIpldBlock(value)
    this.set(block.cid, block.bytes)
    return block.cid
  }

  set(cid: CID, bytes: Uint8Array) {
    this.map.set(cid.toString(), bytes)
  }

  get(cid: CID): Uint8Array | undefined {
    return this.map.get(cid.toString())
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

  addMap(toAdd: BlockMap) {
    toAdd.forEach((bytes, cid) => {
      this.set(cid, bytes)
    })
  }
}

type Entry = {
  cid: CID
  bytes: Uint8Array
}

export default BlockMap
