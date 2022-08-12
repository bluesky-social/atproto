import { CID } from 'multiformats/cid'
import { BlockstoreI } from './types'

export class MemoryBlockstore implements BlockstoreI {
  map: Map<string, Uint8Array>

  constructor() {
    this.map = new Map()
  }

  async get(k: CID): Promise<Uint8Array> {
    const v = this.map.get(k.toString())
    if (!v) throw new Error(`Not found: ${k.toString()}`)
    return v
  }

  async put(k: CID, v: Uint8Array): Promise<void> {
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
