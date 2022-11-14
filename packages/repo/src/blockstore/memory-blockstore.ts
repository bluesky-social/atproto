import { CID } from 'multiformats/cid'
import IpldStore from './ipld-store'

export class MemoryBlockstore extends IpldStore {
  blocks: Map<string, Uint8Array>
  staged: Map<string, Uint8Array>

  constructor() {
    super()
    this.blocks = new Map()
    this.staged = new Map()
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    const fromStaged = this.staged.get(cid.toString())
    if (fromStaged) return fromStaged
    const fromBlocks = this.blocks.get(cid.toString())
    if (fromBlocks) return fromBlocks
    throw new Error(`Not found: ${cid.toString()}`)
  }

  // async putBytes(k: CID, v: Uint8Array): Promise<void> {
  //   this.map.set(k.toString(), v)
  // }

  async stageBytes(k: CID, v: Uint8Array): Promise<void> {
    this.staged.set(k.toString(), v)
  }

  async saveStaged(): Promise<void> {
    this.staged.forEach((val, key) => {
      this.blocks.set(key, val)
    })
    this.clearStaged()
  }

  async clearStaged(): Promise<void> {
    this.staged.clear()
  }

  async has(cid: CID): Promise<boolean> {
    return this.staged.has(cid.toString()) || this.blocks.has(cid.toString())
  }

  async sizeInBytes(): Promise<number> {
    let total = 0
    for (const val of this.blocks.values()) {
      total += val.byteLength
    }
    return total
  }

  async destroy(): Promise<void> {
    this.staged.clear()
    this.blocks.clear()
  }

  // Mainly for dev purposes
  async getContents(): Promise<Record<string, unknown>> {
    const contents: Record<string, unknown> = {}
    for (const key of this.blocks.keys()) {
      contents[key] = await this.getUnchecked(CID.parse(key))
    }
    return contents
  }
}

export default MemoryBlockstore
