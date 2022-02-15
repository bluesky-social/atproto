import { CID } from "multiformats"
import * as check from "./type-check.js"
import { IdMapping } from "./types.js"
import IpldStore from "./ipld-store.js"

export type TableSize = 100 | 400 | 1600 | 6400

export class SSTable {

  store: IpldStore
  cid: CID
  size: TableSize
  currSize: number
  data: IdMapping

  constructor(store: IpldStore, cid: CID, size: TableSize, currSize: number, data: IdMapping) {
    this.store = store
    this.cid = cid
    this.size = size
    this.currSize = currSize
    this.data = data
  }

  static async create(store: IpldStore, size: TableSize): Promise<SSTable> {
    const cid = await store.put({})
    return new SSTable(store, cid, size, 0, {})
  }

  static async get(store: IpldStore, cid: CID): Promise<SSTable> {
    const data = await store.get(cid, check.assureIdMapping)
    // @TODO fix size here
    return new SSTable(store, cid, 100, Object.keys(data).length, data)
  }

  static async merge(tables: SSTable[]): Promise<SSTable> {
    if(tables.length < 1) {
      throw new Error("Must provide at least one table")
    } 
    const store = tables[0].store
    // @TODO check size & ordering & merge conflicts
    const data = tables
      .map(t => t.data)
      .reduce((acc, cur) => {
        return {
          ...acc,
          ...cur
        }
      }, {} as IdMapping)
    const cid = await store.put(data)
    return new SSTable(store, cid, 100, Object.keys(data).length, data) 
  }

  async getEntry(id: string): Promise<CID> {
    return this.data[id]
  }

  async addEntry(id: string, cid: CID): Promise<void> {
    if(this.data[id]) {
      throw new Error(`Entry already exists for id ${id}`)
    }
    this.data[id] = cid
    this.cid = await this.store.put(this.data)
  }

  async editEntry(id: string, cid: CID): Promise<void> {
    if(!this.data[id]) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    this.data[id] = cid
    this.cid = await this.store.put(this.data)
  }

  async removeEntry(id: string): Promise<void> {
    if(!this.data[id]) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    delete this.data[id]
    this.cid = await this.store.put(this.data)
  }

}

export default SSTable
