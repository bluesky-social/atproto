import { DIDDocument } from 'did-resolver'
import level from 'level'

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

  async put(did: string, privateKey: string): Promise<void> {
    await this.store.put(did, privateKey)
  }

  async get(didPath: string): Promise<string | null> {
    try {
      return await this.store.get(didPath)
    } catch (err) {
      console.log(`Could not get did with path ${didPath}: ${err}`)
      return null
    }
  }

  async del(didPath: string): Promise<void> {
    await this.store.del(didPath)
  }
}

export default KeyManagerDb
