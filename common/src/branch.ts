import { CID } from "multiformats"
import * as check from "./type-check.js"

import IpldStore from "./ipld-store.js"
import { IdMapping } from "./types.js"
import SSTable from "./SSTable.js"

export class Branch {

  store: IpldStore
  cid: CID
  data: IdMapping

  constructor(store: IpldStore, cid: CID, data: IdMapping) {
    this.store = store
    this.cid = cid
    this.data = data
  }

  static async create(store: IpldStore): Promise<Branch> {
    const cid = await store.put({})
    return new Branch(store, cid, {})
  }

  static async get(store: IpldStore, cid: CID): Promise<Branch> {
    const data = await store.get(cid, check.assureIdMapping)
    return new Branch(store, cid, data)
  }

  async getOrCreateCurrTable(): Promise<{ table: SSTable, name: string | null}> {
    const curr = await this.getCurrTable()
    if (curr) {
      if (curr.table.currSize < curr.table.size) {
        return curr
      } else {
        await this.compressTables()
      }
    } 

    return {
      table: await SSTable.create(this.store, 100),
      name: null
    }
  }

  async getCurrTable(): Promise<{ table: SSTable, name: string} | null> {
    const keys = Object.keys(this.data)
    const key = keys[keys.length -1]
    if (key === undefined) return null
    const cid = this.data[key]
    if (cid === undefined) return null
    return {
      table: await SSTable.get(this.store, cid),
      name: key
    }
  }

  async compressTables(): Promise<void> {
    const keys = Object.keys(this.data)
    let count = 0
    // @TODO compress tables
  }

  async addEntry(id: string, cid: CID): Promise<void> {
    const { table, name } = await this.getOrCreateCurrTable()
    await table.addEntry(id, cid)
    this.data[name || id] = table.cid
    this.cid = await this.store.put(this.data)
  }

}

export default Branch
