import { CID } from "multiformats"
import * as check from "./type-check.js"
import { IdMapping } from "./types.js"
import IpldStore from "./ipld-store.js"
import Timestamp from "./timestamp.js"

export enum TableSize {
  sm = 'sm',
  md = 'md',
  lg = 'lg',
  xl = 'xl',
}

export class SSTable {

  store: IpldStore
  cid: CID
  size: TableSize
  currSize: number
  data: IdMapping

  constructor(store: IpldStore, cid: CID, data: IdMapping) {
    this.store = store
    this.cid = cid
    this.data = data
    this.currSize = Object.keys(data).length
    this.size = nameForSize(this.currSize)
  }

  static async create(store: IpldStore): Promise<SSTable> {
    const cid = await store.put({})
    return new SSTable(store, cid, {})
  }

  static async get(store: IpldStore, cid: CID): Promise<SSTable> {
    const data = await store.get(cid, check.assureIdMapping)
    return new SSTable(store, cid, data)
  }

  static async merge(tables: SSTable[]): Promise<SSTable> {
    if(tables.length < 1) {
      throw new Error("Must provide at least one table")
    } 
    const store = tables[0].store
    const data = tables
      .map(t => t.data)
      .reduce((acc, cur) => {
        Object.entries(cur).forEach(([key, val]) => {
          if(acc[key] !== undefined) {
            throw new Error(`Merge conflict on key: ${key}`)
          }
          acc[key] = val
        })
        return acc
      }, {} as IdMapping)

    const cid = await store.put(data)
    return new SSTable(store, cid, data) 
  }

  async getEntry(timestamp: Timestamp): Promise<CID> {
    return this.data[timestamp.toString()]
  }

  async addEntry(timestamp: Timestamp, cid: CID): Promise<void> {
    // @TODO allow some leeway room?
    if (this.currSize >= this.maxSize()) {
      throw new Error("Table is full")
    }
    const id = timestamp.toString()
    if(this.data[id]) {
      throw new Error(`Entry already exists for id ${id}`)
    }
    this.data[id] = cid
    this.cid = await this.store.put(this.data)
  }

  async addEntries(ids: IdMapping): Promise<void> {
    Object.entries(ids).forEach(([id, cid]) => {
      if(this.data[id]) {
        throw new Error(`Entry already exists for id ${id}`)
      }
      this.data[id] = cid
    })
    this.cid = await this.store.put(this.data)
  }

  async editEntry(timestamp: Timestamp, cid: CID): Promise<void> {
    const id = timestamp.toString()
    if(!this.data[id]) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    this.data[id] = cid
    this.cid = await this.store.put(this.data)
  }

  async removeEntry(timestamp: Timestamp): Promise<void> {
    const id = timestamp.toString()
    if(!this.data[id]) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    delete this.data[id]
    this.cid = await this.store.put(this.data)
  }

  keys(): Timestamp[] {
    return Object.keys(this.data).sort().reverse().map(k => Timestamp.parse(k))
  }

  cids(): CID[] {
    return Object.values(this.data).sort().reverse()
  }

  maxSize(): number {
    return sizeForName(this.size)
  }

  isFull(): boolean {
    return this.currSize >= this.maxSize()
  }
}

const sizeForName = (size: TableSize): number => {
  switch (size) {
    case TableSize.sm: return 100
    case TableSize.md: return 400
    case TableSize.lg: return 1600
    case TableSize.xl: return 6400
  }
}

const nameForSize = (size: number): TableSize => {
  if (size <= 100) {
    return TableSize.sm
  } else if (size <= 400) {
    return TableSize.md
  } else if (size <= 1600) {
    return TableSize.lg
  } else {
    return TableSize.xl
  } 
}

export default SSTable
