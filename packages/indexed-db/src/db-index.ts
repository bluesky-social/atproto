import { promisify } from './util.js'

export class DBIndex {
  #index: IDBIndex

  constructor(index: IDBIndex) {
    this.#index = index
  }

  count(query?: IDBValidKey | IDBKeyRange) {
    return promisify(this.#index.count(query))
  }

  get(query: IDBValidKey | IDBKeyRange) {
    return promisify(this.#index.get(query))
  }

  getKey(query: IDBValidKey | IDBKeyRange) {
    return promisify(this.#index.getKey(query))
  }

  getAll(query?: IDBValidKey | IDBKeyRange | null, count?: number) {
    return promisify(this.#index.getAll(query, count))
  }

  getAllKeys(query?: IDBValidKey | IDBKeyRange | null, count?: number) {
    return promisify(this.#index.getAllKeys(query, count))
  }
}
