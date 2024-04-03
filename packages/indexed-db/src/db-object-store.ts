import { DBIndex } from './db-index.js'
import { ObjectStoreSchema } from './schema.js'
import { promisify } from './util.js'

export class DBObjectStore<Schema extends ObjectStoreSchema> {
  #store: IDBObjectStore
  constructor(store: IDBObjectStore) {
    this.#store = store
  }

  get name() {
    return this.#store.name
  }

  index(name: string) {
    return new DBIndex(this.#store.index(name))
  }

  get(key: IDBValidKey | IDBKeyRange) {
    return promisify<Schema>(this.#store.get(key))
  }

  getKey(query: IDBValidKey | IDBKeyRange) {
    return promisify<IDBValidKey | undefined>(this.#store.getKey(query))
  }

  getAll(query?: IDBValidKey | IDBKeyRange | null, count?: number) {
    return promisify<Schema[]>(this.#store.getAll(query, count))
  }

  getAllKeys(query?: IDBValidKey | IDBKeyRange | null, count?: number) {
    return promisify<IDBValidKey[]>(this.#store.getAllKeys(query, count))
  }

  add(value: Schema, key?: IDBValidKey) {
    return promisify(this.#store.add(value, key))
  }

  put(value: Schema, key?: IDBValidKey) {
    return promisify(this.#store.put(value, key))
  }

  delete(key: IDBValidKey | IDBKeyRange) {
    return promisify(this.#store.delete(key))
  }

  clear() {
    return promisify(this.#store.clear())
  }
}
