import { DBIndex } from './db-index.js'
import { ObjectStoreSchema } from './schema.js'
import { promisify } from './util.js'

export class DBObjectStore<Schema extends ObjectStoreSchema> {
  constructor(private idbObjStore: IDBObjectStore) {}

  get name() {
    return this.idbObjStore.name
  }

  index(name: string) {
    return new DBIndex<Schema>(this.idbObjStore.index(name))
  }

  get(key: IDBValidKey | IDBKeyRange) {
    return promisify<Schema>(this.idbObjStore.get(key))
  }

  getKey(query: IDBValidKey | IDBKeyRange) {
    return promisify<IDBValidKey | undefined>(this.idbObjStore.getKey(query))
  }

  getAll(query?: IDBValidKey | IDBKeyRange | null, count?: number) {
    return promisify<Schema[]>(this.idbObjStore.getAll(query, count))
  }

  getAllKeys(query?: IDBValidKey | IDBKeyRange | null, count?: number) {
    return promisify<IDBValidKey[]>(this.idbObjStore.getAllKeys(query, count))
  }

  add(value: Schema, key?: IDBValidKey) {
    return promisify(this.idbObjStore.add(value, key))
  }

  put(value: Schema, key?: IDBValidKey) {
    return promisify(this.idbObjStore.put(value, key))
  }

  delete(key: IDBValidKey | IDBKeyRange) {
    return promisify(this.idbObjStore.delete(key))
  }

  clear() {
    return promisify(this.idbObjStore.clear())
  }
}
