import { CID } from 'multiformats/cid'

export default class MemoryDB {

  map: Map<string, any>

  constructor() {
    this.map = new Map()
  }

  async get(k: CID) {
    return this.map.get(k.toString())
  }

  async put(k: CID, v: Uint8Array) {
    this.map.set(k.toString(), v)
  }
}
