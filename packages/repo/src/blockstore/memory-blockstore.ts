import { CID } from 'multiformats/cid'
import IpldStore from './ipld-store'

export class MemoryBlockstore extends IpldStore {
  blocks: Map<string, Uint8Array>

  constructor() {
    super()
    this.blocks = new Map()
  }

  async getSavedBytes(cid: CID): Promise<Uint8Array | null> {
    return this.blocks.get(cid.toString()) || null
  }

  async hasSavedBlock(cid: CID): Promise<boolean> {
    return this.blocks.has(cid.toString())
  }

  async saveStaged(): Promise<void> {
    this.staged.forEach((val, key) => {
      this.blocks.set(key, val)
    })
    this.clearStaged()
  }

  async sizeInBytes(): Promise<number> {
    let total = 0
    for (const val of this.blocks.values()) {
      total += val.byteLength
    }
    return total
  }

  async destroySaved(): Promise<void> {
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
