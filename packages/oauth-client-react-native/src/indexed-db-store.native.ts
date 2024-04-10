import { GenericStore, Key, Value } from '@atproto/caching'
import Storage from '@react-native-async-storage/async-storage'

const storeName = 'store'

export class IndexedDBStore<
  K extends Extract<IDBValidKey, Key>,
  V extends Value,
> implements GenericStore<K, V>
{
  constructor(
    private dbName: string,
    protected maxAge = 600e3,
  ) {}

  async get(key: K): Promise<V | undefined> {
    const fullKey = `${storeName}.${this.dbName}.${key}`
    const value = await Storage.getItem(fullKey)

    if (!value) return undefined

    const createdAt = await Storage.getItem(`${storeName}.${fullKey}.createdAt`)
    const age = Date.now() - Number(createdAt)

    if (age > this.maxAge) {
      await this.del(key)
      return undefined
    }

    return value as any
  }

  async set(key: K, value: V): Promise<void> {
    const fullKey = `${storeName}.${this.dbName}.${key}`
    await Storage.setItem(fullKey, value as string)
    await Storage.setItem(
      `${storeName}.${fullKey}.createdAt`,
      Date.now().toString(),
    )
  }

  async del(key: K): Promise<void> {
    const fullKey = `${storeName}.${this.dbName}.${key}`
    await Storage.removeItem(fullKey)
    await Storage.removeItem(`${storeName}.${fullKey}.createdAt`)
  }

  async deleteOutdated() {
    const upperBound = new Date(Date.now() - this.maxAge)

    const allKeys = await Storage.getAllKeys()

    for (const key of allKeys) {
      if (key.startsWith(`${storeName}.${this.dbName}.`)) {
        const createdAt = await Storage.getItem(`${storeName}.${key}.createdAt`)
        if (createdAt && new Date(Number(createdAt)) < upperBound) {
          await Storage.removeItem(key)
          await Storage.removeItem(`${storeName}.${key}.createdAt`)
        }
      }
    }
  }
}
