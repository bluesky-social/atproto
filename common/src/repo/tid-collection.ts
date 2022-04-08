import { CID } from 'multiformats'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import IpldStore from '../blockstore/ipld-store.js'
import {
  TIDEntry,
  IdMapping,
  CarStreamable,
  schema,
  UpdateData,
  Collection,
} from './types.js'
import SSTable, { TableSize } from './ss-table.js'
import TID from './tid.js'
import CidSet from './cid-set.js'
import * as delta from './delta.js'

export class TidCollection implements CarStreamable {
  blockstore: IpldStore
  cid: CID
  data: IdMapping
  onUpdate: ((update: UpdateData) => Promise<void>) | null

  constructor(blockstore: IpldStore, cid: CID, data: IdMapping) {
    this.blockstore = blockstore
    this.cid = cid
    this.data = data
    this.onUpdate = null
  }

  static async create(blockstore: IpldStore): Promise<TidCollection> {
    const cid = await blockstore.put({})
    return new TidCollection(blockstore, cid, {})
  }

  static async load(blockstore: IpldStore, cid: CID): Promise<TidCollection> {
    const data = await blockstore.get(cid, schema.idMapping)
    return new TidCollection(blockstore, cid, data)
  }

  async getTable(name: TID): Promise<SSTable | null> {
    if (!name) return null
    const cid = this.data[name.toString()]
    if (cid === undefined) return null
    return SSTable.load(this.blockstore, cid)
  }

  getTableNameForTid(tid: TID): TID | null {
    return this.tableNames().find((n) => !tid.olderThan(n)) || null
  }

  async getTableForId(tid: TID): Promise<SSTable | null> {
    const name = this.getTableNameForTid(tid)
    if (!name) return null
    return this.getTable(name)
  }

  async updateRoot(tid: TID, newCids: CidSet): Promise<void> {
    this.cid = await this.blockstore.put(this.data)
    if (this.onUpdate) {
      await this.onUpdate({
        tid,
        newCids: newCids.add(this.cid),
      })
    }
  }

  // NOTE: this will likely be changing to recursive tables (instead of compression) soon(ish)
  async compressTables(): Promise<CidSet> {
    const tableNames = this.tableNames()
    if (tableNames.length < 1) return new CidSet()
    const mostRecent = await this.getTable(tableNames[0])
    if (mostRecent === null) return new CidSet()
    const compressed = await this.compressCascade(
      mostRecent,
      tableNames.slice(1),
    )
    const tableName = compressed.table.oldestTid()
    if (tableName && !tableName.equals(tableNames[0])) {
      delete this.data[tableNames[0].toString()]
      this.data[tableName.toString()] = compressed.table.cid
    }
    return compressed.newCids
  }

  private async compressCascade(
    mostRecent: SSTable,
    nextKeys: TID[],
  ): Promise<{ table: SSTable; newCids: CidSet }> {
    const size = mostRecent.size
    const keys = nextKeys.slice(0, 3)
    const tables = await Promise.all(keys.map((k) => this.getTable(k)))
    const filtered = tables.filter((t) => t?.size === size) as SSTable[]
    // need 4 tables to merge down a level
    if (filtered.length < 3 || size === TableSize.xl) {
      // if no merge at this level, we just return the previous level
      return { table: mostRecent, newCids: new CidSet() }
    }

    keys.forEach((k) => delete this.data[k.toString()])

    const merged = await SSTable.merge([mostRecent, ...filtered])
    const { table, newCids } = await this.compressCascade(
      merged,
      nextKeys.slice(3),
    )
    return { table, newCids: newCids.add(merged.cid) }
  }

  async getEntry(tid: TID): Promise<CID | null> {
    const table = await this.getTableForId(tid)
    if (!table) return null
    return table.getEntry(tid)
  }

  async getEntries(count: number, from?: TID): Promise<TIDEntry[]> {
    const names = this.tableNames()
    const index =
      from !== undefined ? names.findIndex((n) => !from.olderThan(n)) : 0
    if (index === -1) return []

    let entries: TIDEntry[] = []
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

  async getAllEntries(): Promise<TIDEntry[]> {
    return this.getEntries(Number.MAX_SAFE_INTEGER)
  }

  // helper method to return table instance to write to, but leaves responsibility of adding table to `data` to the caller
  private async getOrCreateCurrTable(): Promise<{
    table: SSTable
    newCids: CidSet
  }> {
    const name = this.tableNames()[0]
    const table = name ? await this.getTable(name) : null
    if (table === null) {
      return {
        table: await SSTable.create(this.blockstore),
        newCids: new CidSet(),
      }
    }
    if (table.isFull()) {
      const newCids = await this.compressTables()
      return { table: await SSTable.create(this.blockstore), newCids }
    } else {
      return { table, newCids: new CidSet() }
    }
  }

  async addEntry(tid: TID, cid: CID): Promise<void> {
    const { table, newCids } = await this.getOrCreateCurrTable()
    const oldestKey = table.oldestTid()
    if (oldestKey && tid.olderThan(oldestKey)) {
      // @TODO handle this more gracefully
      throw new Error('Attempting to add an id that is too old for the table')
    }
    await table.addEntry(tid, cid)
    const tableName = oldestKey?.toString() || tid.toString()
    this.data[tableName] = table.cid
    await this.updateRoot(tid, newCids.add(cid).add(table.cid))
  }

  private async editTableForTid(
    tid: TID,
    fn: (table: SSTable) => Promise<CidSet>,
  ): Promise<void> {
    const tableName = this.getTableNameForTid(tid)
    if (!tableName) throw new Error(`Could not find entry with tid: ${tid}`)
    const table = await this.getTable(tableName)
    if (!table) throw new Error(`Could not find entry with tid: ${tid}`)
    const newCids = await fn(table)
    this.data[tableName.toString()] = table.cid
    await this.updateRoot(tid, newCids.add(table.cid))
  }

  async editEntry(tid: TID, cid: CID): Promise<void> {
    await this.editTableForTid(tid, async (table) => {
      await table.editEntry(tid, cid)
      return new CidSet([cid])
    })
  }

  async deleteEntry(tid: TID): Promise<void> {
    await this.editTableForTid(tid, async (table) => {
      await table.deleteEntry(tid)
      return new CidSet()
    })
  }

  tableNames(oldestFirst = false): TID[] {
    const tids = Object.keys(this.data).map((k) => TID.fromStr(k))
    return oldestFirst ? tids.sort(TID.oldestFirst) : tids.sort(TID.newestFirst)
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
      const table = await SSTable.load(this.blockstore, cid)
      table.cids().forEach((c) => all.push(c))
    }
    return all
  }

  async verifyUpdate(
    prev: TidCollection,
    newCids: CidSet,
    namespace: string,
    collection: Collection,
  ): Promise<delta.Event[]> {
    // @TODO: we need a better algo here, but probably changing how SSTables work soon
    // and not going to waste time writing an optimized one for our current structure
    // (will be easier to write for recursive tables)
    const events: delta.Event[] = []
    const currEntries = await this.getAllEntries()
    const prevEntries = await prev.getAllEntries()
    const entriesDiff = delta.tidEntriesDiff(prevEntries, currEntries, newCids)

    // object deletes: we can emit as events
    for (const del of entriesDiff.deletes) {
      events.push(
        delta.deletedObject(namespace, collection, TID.fromStr(del.key)),
      )
    }
    // object adds: we can emit as events
    for (const add of entriesDiff.adds) {
      events.push(
        delta.addedObject(namespace, collection, TID.fromStr(add.key), add.cid),
      )
    }
    // object updates: we can emit as events
    for (const update of entriesDiff.updates) {
      events.push(
        delta.updatedObject(
          namespace,
          collection,
          TID.fromStr(update.key),
          update.cid,
          update.old,
        ),
      )
    }
    return events
  }

  async missingCids(): Promise<CidSet> {
    const missing = new CidSet()
    for (const cid of this.shallowCids()) {
      if (await this.blockstore.has(cid)) {
        const table = await SSTable.load(this.blockstore, cid)
        const tableMissing = await table.missingCids()
        missing.addSet(tableMissing)
      } else {
        missing.add(cid)
      }
    }
    return missing
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    const cids = this.shallowCids()
    for (const cid of cids) {
      const table = await SSTable.load(this.blockstore, cid)
      await table.writeToCarStream(car)
    }
    await this.blockstore.addToCar(car, this.cid)
  }
}

export default TidCollection
