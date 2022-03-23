import level from 'level'
import { CID } from 'multiformats/cid'

import { BlockstoreI } from './types.js'

export class PersistentBlockstore implements BlockstoreI {
  store: level.LevelDB

  constructor(location = 'blockstore') {
    this.store = level(location, {
      valueEncoding: 'binary',
      compression: false,
    })
  }

  async get(cid: CID): Promise<Uint8Array> {
    return this.store.get(cid.toString())
  }

  async put(cid: CID, bytes: Uint8Array): Promise<void> {
    await this.store.put(cid.toString(), bytes)
  }

  async has(cid: CID): Promise<boolean> {
    try {
      await this.get(cid)
      return true
    } catch (_) {
      return false
    }
  }

  async destroy(): Promise<void> {
    await this.store.clear()
    await this.store.close()
  }
}

export default PersistentBlockstore
