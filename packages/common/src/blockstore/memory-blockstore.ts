import { CID } from 'multiformats/cid'
import IpldStore from './ipld-store'

export class MemoryBlockstore extends IpldStore {
  map: Map<string, Uint8Array>

  constructor() {
    super()
    this.map = new Map()
  }

  async getBytes(k: CID): Promise<Uint8Array> {
    const v = this.map.get(k.toString())
    if (!v) throw new Error(`Not found: ${k.toString()}`)
    return v
  }

  async putBytes(k: CID, v: Uint8Array): Promise<void> {
    this.map.set(k.toString(), v)
  }

  async has(k: CID): Promise<boolean> {
    return this.map.has(k.toString())
  }

  async sizeInBytes(): Promise<number> {
    let total = 0
    for (const val of this.map.values()) {
      total += val.byteLength
    }
    return total
  }

  async destroy(): Promise<void> {
    this.map.clear()
  }
}

export default MemoryBlockstore
