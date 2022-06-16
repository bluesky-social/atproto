import * as ucan from 'ucans'
import AuthStore from './auth-store.js'

export class MemoryStore extends AuthStore {
  private keypair: ucan.EdKeypair
  private ucanStore: ucan.Store

  constructor(keypair: ucan.EdKeypair, ucanStore: ucan.Store) {
    super()
    this.keypair = keypair
    this.ucanStore = ucanStore
  }

  static async load(): Promise<MemoryStore> {
    const keypair = await ucan.EdKeypair.create({ exportable: true })
    const ucanStore = await ucan.Store.fromTokens([])
    return new MemoryStore(keypair, ucanStore)
  }

  protected async getKeypair(): Promise<ucan.EdKeypair> {
    return this.keypair
  }

  async addUcan(token: ucan.Chained): Promise<void> {
    return this.ucanStore.add(token)
  }

  async getUcanStore(): Promise<ucan.Store> {
    return this.ucanStore
  }

  async clear(): Promise<void> {
    // noop
  }

  async reset(): Promise<void> {
    this.clear()
    this.keypair = await ucan.EdKeypair.create({ exportable: true })
    this.ucanStore = await ucan.Store.fromTokens([])
  }
}

export default MemoryStore
