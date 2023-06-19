import { DidDocument } from '../../src/types'

interface DidStore {
  put(key: string, val: string): Promise<void>
  del(key: string): Promise<void>
  get(key: string): Promise<string>
}

class MemoryStore implements DidStore {
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

export class DidWebDb {
  constructor(private store: DidStore) {}

  static memory(): DidWebDb {
    const store = new MemoryStore()
    return new DidWebDb(store)
  }

  async put(didPath: string, didDoc: DidDocument): Promise<void> {
    await this.store.put(didPath, JSON.stringify(didDoc))
  }

  async get(didPath: string): Promise<DidDocument | null> {
    try {
      const got = await this.store.get(didPath)
      return JSON.parse(got)
    } catch (err) {
      console.log(`Could not get did with path ${didPath}: ${err}`)
      return null
    }
  }

  async has(didPath: string): Promise<boolean> {
    const got = await this.get(didPath)
    return got !== null
  }

  async del(didPath: string): Promise<void> {
    await this.store.del(didPath)
  }
}

export default DidWebDb
