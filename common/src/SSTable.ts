import { CID } from "multiformats"
import * as check from "./type-check.js"
import { IpldStore, SSTableData } from "./types.js"

export type TableSize = 100 | 400 | 1600 | 6400

export class SSTable {

  blockstore: IpldStore
  cid: CID
  size: TableSize
  data: SSTableData

  constructor(blockstore: IpldStore, cid: CID, size: TableSize, data: SSTableData) {
    this.blockstore = blockstore
    this.cid = cid
    this.size = size
    this.data = data
  }

  static async create(blockstore: IpldStore, size: TableSize): Promise<SSTable> {
    const cid = await blockstore.putIpld({})
    return new SSTable(blockstore, cid, size, {})
  }

  static async get(blockstore: IpldStore, cid: CID): Promise<SSTable> {
    const data = await blockstore.getIpld(cid, check.assureSSTableData)
    // @TODO fix size here
    return new SSTable(blockstore, cid, 100, {})
  }

  static async merge(tables: SSTable[]): Promise<SSTable> {
    if(tables.length < 1) {
      throw new Error("Must provide at least one table")
    } 
    const blockstore = tables[0].blockstore
    // @TODO check size & ordering & merge conflicts
    const data = tables
      .map(t => t.data)
      .reduce((acc, cur) => {
        return {
          ...acc,
          ...cur
        }
      }, {} as SSTableData)
    const cid = await blockstore.putIpld(data)
    return new SSTable(blockstore, cid, 100, data) 
  }

  async addEntry(id: string, cid: CID): Promise<void> {
    if(this.data[id]) {
      throw new Error(`Entry already exists for id ${id}`)
    }
    this.data[id] = cid
    this.cid = await this.blockstore.putIpld(this.data)
  }

  async editEntry(id: string, cid: CID): Promise<void> {
    if(!this.data[id]) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    this.data[id] = cid
    this.cid = await this.blockstore.putIpld(this.data)
  }

  async removeEntry(id: string): Promise<void> {
    if(!this.data[id]) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    delete this.data[id]
    this.cid = await this.blockstore.putIpld(this.data)
  }

}

export default SSTable
