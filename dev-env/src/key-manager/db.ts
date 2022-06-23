import { DIDDocument } from 'did-resolver'
import level from 'level'
import * as crypto from '@adxp/crypto'

interface KeyStore {
  put(key: string, val: string): Promise<void>
  del(key: string): Promise<void>
  get(key: string): Promise<string>
}

// @TODO same as did:web MemoryStore, refactor
class MemoryStore implements KeyStore {
  private store: Record<string, string> = {}

  async put(key: string, val: string): Promise<void> {
    this.store[key] = val
  }

  async del(key: string): Promise<void> {
    this.assertHas(key)
    delete this.store[key]
  }

  async get(key: string): Promise<string> {
    this.assertHas(key)
    return this.store[key]
  }

  assertHas(key: string): void {
    if (!this.store[key]) {
      throw new Error(`No object with key: ${key}`)
    }
  }
}

export class KeyManagerDb {
  constructor(private store: KeyStore) {}

  static persistent(location = 'dids'): KeyManagerDb {
    const store = new level.Level(location)
    return new KeyManagerDb(store)
  }

  static memory(): KeyManagerDb {
    const store = new MemoryStore()
    return new KeyManagerDb(store)
  }

  async put(did: string, keypair: crypto.EcdsaKeypair): Promise<void> {
    const exported = await keypair.export()
    await this.store.put(did, JSON.stringify(exported))
  }

  async get(did: string): Promise<crypto.EcdsaKeypair | null> {
    let exportedKey: string
    try {
      exportedKey = await this.store.get(did)
    } catch (err) {
      console.log(`Could not get did with path ${did}: ${err}`)
      return null
    }
    try {
      return await crypto.EcdsaKeypair.import(JSON.parse(exportedKey))
    } catch (err) {
      throw new Error(`Could not parse stored exported key: ${err}`)
    }
  }

  async del(did: string): Promise<void> {
    await this.store.del(did)
  }
}

export default KeyManagerDb
