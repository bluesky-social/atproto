import level from 'level'
import { CID } from 'multiformats/cid'
import IpldStore from './ipld-store'

export class PersistentBlockstore extends IpldStore {
  store: level.Level

  constructor(location = 'blockstore') {
    super()
    this.store = new level.Level(location, {
      valueEncoding: 'view',
      compression: false,
    })
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    return this.store.get(cid.toString(), { valueEncoding: 'view' })
  }

  async putBytes(cid: CID, bytes: Uint8Array): Promise<void> {
    await this.store.put(cid.toString(), bytes, { valueEncoding: 'view' })
  }

  async has(cid: CID): Promise<boolean> {
    try {
      await this.getBytes(cid)
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
