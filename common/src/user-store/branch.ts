import { CID } from 'multiformats'
import * as check from '../type-check.js'

import IpldStore from '../blockstore/ipld-store.js'
import { Entry, IdMapping } from '../types.js'
import SSTable, { TableSize } from './ss-table.js'
import Timestamp from '../timestamp.js'

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

  static async load(store: IpldStore, cid: CID): Promise<Branch> {
    const data = await store.get(cid, check.assureIdMapping)
    return new Branch(store, cid, data)
  }

  async getTable(name: Timestamp): Promise<SSTable | null> {
    if (!name) return null
    const cid = this.data[name.toString()]
    if (cid === undefined) return null
    return SSTable.load(this.store, cid)
  }

  getTableNameForId(id: Timestamp): Timestamp | null {
    return this.tableNames().find((n) => !id.olderThan(n)) || null
  }

  async getTableForId(id: Timestamp): Promise<SSTable | null> {
    const name = this.getTableNameForId(id)
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
    const compressed = await this.compressCascade(
      mostRecent,
      tableNames.slice(1),
    )
    const tableName = compressed.oldestId()
    if (tableName && !tableName.equals(tableNames[0])) {
      delete this.data[tableNames[0].toString()]
      this.data[tableName.toString()] = compressed.cid
    }
    await this.updateRoot()
  }

  private async compressCascade(
    mostRecent: SSTable,
    nextKeys: Timestamp[],
  ): Promise<SSTable> {
    const size = mostRecent.size
    const keys = nextKeys.slice(0, 3)
    const tables = await Promise.all(keys.map((k) => this.getTable(k)))
    const filtered = tables.filter((t) => t?.size === size) as SSTable[]
    // need 4 tables to merge down a level
    if (filtered.length < 3 || size === TableSize.xl) {
      // if no merge at this level, we just return the p;revious level
      return mostRecent
    }

    keys.forEach((k) => delete this.data[k.toString()])

    const merged = await SSTable.merge([mostRecent, ...filtered])
    return await this.compressCascade(merged, nextKeys.slice(3))
  }

  async getEntry(id: Timestamp): Promise<CID | null> {
    const table = await this.getTableForId(id)
    if (!table) return null
    return table.getEntry(id)
  }

  async getEntries(count: number, from?: Timestamp): Promise<Entry[]> {
    const names = this.tableNames()
    const index =
      from !== undefined ? names.findIndex((n) => !from.olderThan(n)) : 0

    if (index === -1) return []

    let entries: Entry[] = []

    for (let i = index; i < names.length; i++) {
      const table = await this.getTable(names[i])
      if (table === null) {
        throw new Error(`Could not read table: ${names[i]}`)
      }
      const tableEntries = table.entries()
      // for first table we only want entries older than `from`, otherwise start from beginning
      const tableStartIndex =
        from !== undefined && i === index
          ? tableEntries.findIndex((e) => e.id.olderThan(from))
          : 0

      const tableEndIndex = tableStartIndex + (count - entries.length)
      const tableSlice = tableEntries.slice(tableStartIndex, tableEndIndex)

      entries = entries.concat(tableSlice)
    }

    return entries
  }

  // helper method to return table instance to write to, but leaves responsibility of adding table to `data` to the caller
  private async getOrCreateCurrTable(): Promise<SSTable> {
    const name = this.tableNames()[0]
    const table = name ? await this.getTable(name) : null
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

  async addEntry(id: Timestamp, cid: CID): Promise<void> {
    const table = await this.getOrCreateCurrTable()
    const oldestKey = table.oldestId()
    if (oldestKey && id.olderThan(oldestKey)) {
      // @TODO handle this more gracefully
      throw new Error('Attempting to add an id that is too old for the table')
    }
    await table.addEntry(id, cid)
    const tableName = oldestKey?.toString() || id.toString()
    this.data[tableName] = table.cid
    await this.updateRoot()
  }

  async editTableForId(
    id: Timestamp,
    fn: (table: SSTable) => Promise<void>,
  ): Promise<void> {
    const tableName = this.getTableNameForId(id)
    if (!tableName) throw new Error(`Could not find entry with id: ${id}`)
    const table = await this.getTable(tableName)
    if (!table) throw new Error(`Could not find entry with id: ${id}`)
    await fn(table)
    this.data[tableName.toString()] = table.cid
    await this.updateRoot()
  }

  async editEntry(id: Timestamp, cid: CID): Promise<void> {
    await this.editTableForId(id, async (table) => {
      await table.editEntry(id, cid)
    })
  }

  async deleteEntry(id: Timestamp): Promise<void> {
    await this.editTableForId(id, async (table) => {
      await table.deleteEntry(id)
    })
  }

  tableNames(oldestFirst = false): Timestamp[] {
    const ids = Object.keys(this.data).map((k) => Timestamp.parse(k))
    return oldestFirst
      ? ids.sort(Timestamp.oldestFirst)
      : ids.sort(Timestamp.newestFirst)
  }

  tableCount(): number {
    return Object.keys(this.data).length
  }

  cids(): CID[] {
    return Object.values(this.data).sort().reverse()
  }

  async nestedCids(): Promise<CID[]> {
    const all = []
    const cids = this.cids()
    for (const cid of cids) {
      all.push(cid)
      const table = await SSTable.load(this.store, cid)
      table.cids().forEach((c) => all.push(c))
    }
    return all
  }
}

export default Branch
