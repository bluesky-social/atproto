import * as crypto from '@adxp/crypto'
import * as ucan from './ucans/index.js'
import AuthStore from './auth-store.js'
import { adxSemantics } from './semantics.js'

export class MemoryStore extends AuthStore {
  static async load(): Promise<MemoryStore> {
    const keypair = await crypto.EcdsaKeypair.create({ exportable: true })
    const ucanStore = await ucan.storeFromTokens(adxSemantics, [])
    return new MemoryStore(keypair, ucanStore)
  }

  async reset(): Promise<void> {
    this.clear()
    this.keypair = await crypto.EcdsaKeypair.create({ exportable: true })
    this.ucanStore = await ucan.storeFromTokens(adxSemantics, [])
  }
}

export default MemoryStore
