import level from 'level'
import { CID } from 'multiformats/cid'
import { BlockstoreI } from './types'

let globalBlockstore: Blockstore | null = null

export class Blockstore implements BlockstoreI {

  store: level.LevelDB

  constructor(name = 'blockstore') {
    this.store = level(name, { 
      valueEncoding: 'binary',
      compression: false
    })
  }

  static getGlobal(): Blockstore {
    if (globalBlockstore === null) {
      globalBlockstore = new Blockstore()
    }
    return globalBlockstore
  }

  async get(cid: CID): Promise<Uint8Array | null> {
    return this.store.get(cid.toString())
  }

  async put(cid: CID, bytes: Uint8Array): Promise<void> {
    await this.store.put(cid.toString(), bytes)
  }

  async destroy(): Promise<void> {
    await this.store.clear()
    await this.store.close()
  }

}

export default Blockstore
