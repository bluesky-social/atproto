import { CID } from 'multiformats'

import IpldStore from '../blockstore/ipld-store.js'
import { Entry, IdMapping, check, Collection } from './types/index.js'
import SSTable, { TableSize } from './ss-table.js'
import Timestamp from './timestamp.js'

export class TablesCollection implements Collection<Timestamp> {
  store: IpldStore
  cid: CID
  data: IdMapping

  constructor(store: IpldStore, cid: CID, data: IdMapping) {
    this.store = store
    this.cid = cid
    this.data = data
  }

  static async create(store: IpldStore): Promise<TablesCollection> {
    const cid = await store.put({})
    return new TablesCollection(store, cid, {})
  }

  static async load(store: IpldStore, cid: CID): Promise<TablesCollection> {
    const data = await store.get(cid, check.assureIdMapping)
    return new TablesCollection(store, cid, data)
  }

  async getTable(name: Timestamp): Promise<SSTable | null> {
    if (!name) return null
    const cid = this.data[name.toString()]
    if (cid === undefined) return null
    return SSTable.load(this.store, cid)
  }

  getTableNameForTid(tid: Timestamp): Timestamp | null {
    return this.tableNames().find((n) => !tid.olderThan(n)) || null
  }

  async getTableForId(tid: Timestamp): Promise<SSTable | null> {
    const name = this.getTableNameForTid(tid)
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
    const tableName = compressed.oldestTid()
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

  async getEntry(tid: Timestamp): Promise<CID | null> {
    const table = await this.getTableForId(tid)
    if (!table) return null
    return table.getEntry(tid)
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
          ? tableEntries.findIndex((e) => e.tid.olderThan(from))
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

  async addEntry(tid: Timestamp, cid: CID): Promise<void> {
    const table = await this.getOrCreateCurrTable()
    const oldestKey = table.oldestTid()
    if (oldestKey && tid.olderThan(oldestKey)) {
      // @TODO handle this more gracefully
      throw new Error('Attempting to add an id that is too old for the table')
    }
    await table.addEntry(tid, cid)
    const tableName = oldestKey?.toString() || tid.toString()
    this.data[tableName] = table.cid
    await this.updateRoot()
  }

  private async editTableForTid(
    tid: Timestamp,
    fn: (table: SSTable) => Promise<void>,
  ): Promise<void> {
    const tableName = this.getTableNameForTid(tid)
    if (!tableName) throw new Error(`Could not find entry with tid: ${tid}`)
    const table = await this.getTable(tableName)
    if (!table) throw new Error(`Could not find entry with tid: ${tid}`)
    await fn(table)
    this.data[tableName.toString()] = table.cid
    await this.updateRoot()
  }

  async editEntry(tid: Timestamp, cid: CID): Promise<void> {
    await this.editTableForTid(tid, async (table) => {
      await table.editEntry(tid, cid)
    })
  }

  async deleteEntry(tid: Timestamp): Promise<void> {
    await this.editTableForTid(tid, async (table) => {
      await table.deleteEntry(tid)
    })
  }

  tableNames(oldestFirst = false): Timestamp[] {
    const tids = Object.keys(this.data).map((k) => Timestamp.parse(k))
    return oldestFirst
      ? tids.sort(Timestamp.oldestFirst)
      : tids.sort(Timestamp.newestFirst)
  }

  tableCount(): number {
    return Object.keys(this.data).length
  }

  shallowCids(): CID[] {
    return Object.values(this.data)
  }

  async cids(): Promise<CID[]> {
    const all = []
    const cids = this.shallowCids()
    for (const cid of cids) {
      all.push(cid)
      const table = await SSTable.load(this.store, cid)
      table.cids().forEach((c) => all.push(c))
    }
    return all
  }
}

export default TablesCollection
