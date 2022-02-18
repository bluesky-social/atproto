import { CID } from "multiformats"
import * as check from "../type-check.js"

import IpldStore from "../blockstore/ipld-store.js"
import { IdMapping } from "../types.js"
import SSTable, { TableSize } from "./ss-table.js"
import Timestamp from "../timestamp.js"

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

  async getOrCreateCurrTable(): Promise<SSTable> {
    const table = await this.getCurrTable()
    if (table === null) {
      return SSTable.create(this.store)
    }
    if (table.isFull()) {
      await this.compressTables()
      return SSTable.create(this.store)
    } else {
      return table
    }
  }

  async getCurrTable(): Promise<SSTable | null> {
    const name = this.tableNames()[0]
    if (name === undefined) return null
    return this.getTable(name)
  }

  async getTable(name: Timestamp): Promise<SSTable | null> {
    if (!name) return null
    const cid = this.data[name.toString()]
    if (cid === undefined) return null
    return SSTable.get(this.store, cid)
  }

  async findTableForId(id: Timestamp): Promise<SSTable | null> {
    const name = this.tableNames().find(n => id.compare(n) >= 0)
    if (!name) return null
    return this.getTable(name)
  }

  async updateRoot(): Promise<void> {
    this.cid = await this.store.put(this.data)
  }

  async compressTables(): Promise<void> {
    const tableNames = this.tableNames()
    if (tableNames.length < 1) return
    const mostRecent = await this.getTable(tableNames[0])
    if (mostRecent === null) return 
    const compressed = await this.compressCascade(mostRecent, tableNames.slice(1))
    const tableName = compressed.oldestId()
    if (tableName && tableName.compare(tableNames[0]) !== 0 ) {
      delete this.data[tableNames[0].toString()]
      this.data[tableName.toString()] = compressed.cid
    }
    await this.updateRoot()
  }

  private async compressCascade(mostRecent: SSTable, nextKeys: Timestamp[]): Promise<SSTable> {
    const size = mostRecent.size
    const keys = nextKeys.slice(0,3)
    const tables = await Promise.all(
      keys.map(k => this.getTable(k))
    )
    const filtered = tables.filter(t => t?.size === size) as SSTable[]
    // need 4 tables to merge down a level
    if (filtered.length < 3 || size === TableSize.xl) {
      // if no merge at this level, we just return the p;revious level
      return mostRecent
    }

    keys.forEach(k => delete this.data[k.toString()])
    
    const merged = await SSTable.merge([mostRecent, ...filtered])
    return await this.compressCascade(merged, nextKeys.slice(3))
  }

  async addEntry(timestamp: Timestamp, cid: CID): Promise<void> {
    const table = await this.getOrCreateCurrTable()
    const oldestKey = table.oldestId()
    if (oldestKey && timestamp.compare(oldestKey) < 0) {
      // @TODO handle this more gracefully
      throw new Error("Attempting to add an id that is too old for the table")
    }
    await table.addEntry(timestamp, cid)
    const tableName = oldestKey?.toString() || timestamp.toString()
    this.data[tableName] = table.cid
    await this.updateRoot()
  }

  async editEntry(id: Timestamp, cid: CID): Promise<void> {
    const table = await this.findTableForId(id)
    if (!table) throw new Error(`Could not find entry with id: ${id}`)
    return table.editEntry(id, cid)
  }

  async deleteEntry(id: Timestamp): Promise<void> {
    const table = await this.findTableForId(id)
    if (!table) throw new Error(`Could not find entry with id: ${id}`)
    return table.deleteEntry(id)
  }

  tableNames(newestFirst = false): Timestamp[] {
    const sorted = Object.keys(this.data).sort()
    const ordered= newestFirst ? sorted : sorted.reverse()
    return ordered.map(k => Timestamp.parse(k))
  }

  cids(): CID[] {
    return Object.values(this.data).sort().reverse()
  }

  async nestedCids(): Promise<CID[]>{
    const all = []
    const cids = this.cids()
    for(const cid of cids) {
      all.push(cid)
      const table = await SSTable.get(this.store, cid)
      table.cids().forEach(c => all.push(c))
    }
    return all
  }
}

export default Branch
