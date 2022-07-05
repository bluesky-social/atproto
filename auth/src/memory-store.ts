import * as ucan from 'ucans'
import AuthStore from './auth-store.js'

export class MemoryStore extends AuthStore {
  static async load(): Promise<MemoryStore> {
    const keypair = await ucan.EdKeypair.create({ exportable: true })
    const ucanStore = await ucan.Store.fromTokens([])
    return new MemoryStore(keypair, ucanStore)
  }

  async reset(): Promise<void> {
    this.clear()
    this.keypair = await ucan.EdKeypair.create({ exportable: true })
    this.ucanStore = await ucan.Store.fromTokens([])
  }
}

export default MemoryStore
