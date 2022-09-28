import * as crypto from '@adxp/crypto'
import AuthStore from './auth-store'

export class MemoryStore extends AuthStore {
  static async load(): Promise<MemoryStore> {
    const keypair = await crypto.EcdsaKeypair.create({ exportable: true })
    return new MemoryStore(keypair, [])
  }

  async reset(): Promise<void> {
    this.clear()
    this.keypair = await crypto.EcdsaKeypair.create({ exportable: true })
    this.tokens = []
    this.ucanStore = null
  }
}

export default MemoryStore
