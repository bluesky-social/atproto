import { CID } from 'multiformats'
import { BlockWriter } from '@ipld/car/lib/writer-browser'

import { CarStreamable, Entry, IdMapping, schema } from './types.js'
import IpldStore from '../blockstore/ipld-store.js'
import TID from './tid.js'

export class SSTable implements CarStreamable {
  store: IpldStore
  cid: CID
  size: TableSize
  data: IdMapping

  constructor(store: IpldStore, cid: CID, data: IdMapping) {
    this.store = store
    this.cid = cid
    this.data = data
    this.size = nameForSize(Object.keys(data).length)
  }

  static async create(store: IpldStore): Promise<SSTable> {
    const cid = await store.put({})
    return new SSTable(store, cid, {})
  }

  static async load(store: IpldStore, cid: CID): Promise<SSTable> {
    const data = await store.get(cid, schema.idMapping)
    return new SSTable(store, cid, data)
  }

  static async merge(tables: SSTable[]): Promise<SSTable> {
    if (tables.length < 1) {
      throw new Error('Must provide at least one table')
    }
    const store = tables[0].store
    const data = tables
      .map((t) => t.data)
      .reduce((acc, cur) => {
        Object.entries(cur).forEach(([key, val]) => {
          if (acc[key] !== undefined) {
            throw new Error(`Merge conflict on key: ${key}`)
          }
          acc[key] = val
        })
        return acc
      }, {} as IdMapping)

    const cid = await store.put(data)
    return new SSTable(store, cid, data)
  }

  getEntry(tid: TID): CID | null {
    return this.data[tid.toString()] || null
  }

  hasEntry(tid: TID): boolean {
    return this.getEntry(tid) !== null
  }

  async addEntry(tid: TID, cid: CID): Promise<void> {
    // @TODO allow some leeway room?
    if (this.isFull()) {
      throw new Error('Table is full')
    }
    if (this.hasEntry(tid)) {
      throw new Error(`Entry already exists for tid ${tid}`)
    }
    this.data[tid.toString()] = cid
    this.cid = await this.store.put(this.data)
  }

  async addEntries(tids: IdMapping): Promise<void> {
    Object.entries(tids).forEach(([tid, cid]) => {
      if (this.data[tid]) {
        throw new Error(`Entry already exists for tid ${tid}`)
      }
      this.data[tid] = cid
    })
    this.cid = await this.store.put(this.data)
  }

  async editEntry(tid: TID, cid: CID): Promise<void> {
    if (!this.hasEntry(tid)) {
      throw new Error(`Entry does not exist for tid ${tid}`)
    }
    this.data[tid.toString()] = cid
    this.cid = await this.store.put(this.data)
  }

  async deleteEntry(tid: TID): Promise<void> {
    if (!this.hasEntry(tid)) {
      throw new Error(`Entry does not exist for tid ${tid}`)
    }
    delete this.data[tid.toString()]
    this.cid = await this.store.put(this.data)
  }

  oldestTid(): TID | null {
    return this.tids(true)[0] || null
  }

  tids(oldestFirst = false): TID[] {
    const tids = Object.keys(this.data).map((k) => TID.fromStr(k))
    return oldestFirst ? tids.sort(TID.oldestFirst) : tids.sort(TID.newestFirst)
  }

  cids(): CID[] {
    return Object.values(this.data)
  }

  entries(): Entry[] {
    return Object.entries(this.data)
      .map(([tid, cid]) => ({ tid: TID.fromStr(tid), cid }))
      .sort((a, b) => TID.newestFirst(a.tid, b.tid))
  }

  currSize(): number {
    return Object.keys(this.data).length
  }

  maxSize(): number {
    return sizeForName(this.size)
  }

  isFull(): boolean {
    return this.currSize() >= this.maxSize()
  }

  async writeToCarStream(car: BlockWriter): Promise<void> {
    for (const cid of this.cids()) {
      await this.store.addToCar(car, cid)
    }
    await this.store.addToCar(car, this.cid)
  }
}

export enum TableSize {
  sm = 'sm',
  md = 'md',
  lg = 'lg',
  xl = 'xl',
}

const sizeForName = (size: TableSize): number => {
  switch (size) {
    case TableSize.sm:
      return 100
    case TableSize.md:
      return 400
    case TableSize.lg:
      return 1600
    case TableSize.xl:
      return 6400
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
