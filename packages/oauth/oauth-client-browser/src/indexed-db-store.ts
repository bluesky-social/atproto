import { Key, SimpleStore, Value } from '@atproto-labs/simple-store'
import { DB, DBObjectStore } from './indexed-db/index.js'

const storeName = 'store'
type Item<V> = {
  value: V
  createdAt: Date
}

export class IndexedDBStore<
  K extends Extract<IDBValidKey, Key>,
  V extends Value,
> implements SimpleStore<K, V>
{
  constructor(
    private dbName: string,
    protected maxAge = 600e3,
  ) {}

  protected async run<R>(
    mode: 'readonly' | 'readwrite',
    fn: (s: DBObjectStore<Item<V>>) => R | Promise<R>,
  ): Promise<R> {
    const db = await DB.open<{ store: Item<V> }>(
      this.dbName,
      [
        (db) => {
          const store = db.createObjectStore(storeName)
          store.createIndex('createdAt', 'createdAt', { unique: false })
        },
      ],
      { durability: 'strict' },
    )
    try {
      return await db.transaction([storeName], mode, (tx) =>
        fn(tx.objectStore(storeName)),
      )
    } finally {
      await db[Symbol.dispose]()
    }
  }

  async get(key: K): Promise<V | undefined> {
    const item = await this.run('readonly', (store) => store.get(key))

    if (!item) return undefined

    const age = Date.now() - item.createdAt.getTime()
    if (age > this.maxAge) {
      await this.del(key)
      return undefined
    }

    return item?.value
  }

  async set(key: K, value: V): Promise<void> {
    await this.run('readwrite', (store) => {
      store.put({ value, createdAt: new Date() }, key)
    })
  }

  async del(key: K): Promise<void> {
    await this.run('readwrite', (store) => {
      store.delete(key)
    })
  }

  async deleteOutdated() {
    const upperBound = new Date(Date.now() - this.maxAge)
    const query = IDBKeyRange.upperBound(upperBound)

    await this.run('readwrite', async (store) => {
      const index = store.index('createdAt')
      const keys = await index.getAllKeys(query)
      for (const key of keys) store.delete(key)
    })
  }
}
