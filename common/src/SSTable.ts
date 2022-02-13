import { CID } from "multiformats"
import * as check from "./type-check.js"
import { SSTableData } from "./types.js"
import IpldStore from "./ipld-store.js"

export type TableSize = 100 | 400 | 1600 | 6400

export class SSTable {

  ipld: IpldStore
  cid: CID
  size: TableSize
  data: SSTableData

  constructor(ipld: IpldStore, cid: CID, size: TableSize, data: SSTableData) {
    this.ipld = ipld
    this.cid = cid
    this.size = size
    this.data = data
  }

  static async create(ipld: IpldStore, size: TableSize): Promise<SSTable> {
    const cid = await ipld.put({})
    return new SSTable(ipld, cid, size, {})
  }

  static async get(ipld: IpldStore, cid: CID): Promise<SSTable> {
    const data = await ipld.get(cid, check.assureSSTableData)
    // @TODO fix size here
    return new SSTable(ipld, cid, 100, data)
  }

  static async merge(tables: SSTable[]): Promise<SSTable> {
    if(tables.length < 1) {
      throw new Error("Must provide at least one table")
    } 
    const ipld = tables[0].ipld
    // @TODO check size & ordering & merge conflicts
    const data = tables
      .map(t => t.data)
      .reduce((acc, cur) => {
        return {
          ...acc,
          ...cur
        }
      }, {} as SSTableData)
    const cid = await ipld.put(data)
    return new SSTable(ipld, cid, 100, data) 
  }

  async addEntry(id: string, cid: CID): Promise<void> {
    if(this.data[id]) {
      throw new Error(`Entry already exists for id ${id}`)
    }
    this.data[id] = cid
    this.cid = await this.ipld.put(this.data)
  }

  async editEntry(id: string, cid: CID): Promise<void> {
    if(!this.data[id]) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    this.data[id] = cid
    this.cid = await this.ipld.put(this.data)
  }

  async removeEntry(id: string): Promise<void> {
    if(!this.data[id]) {
      throw new Error(`Entry does not exist for id ${id}`)
    }
    delete this.data[id]
    this.cid = await this.ipld.put(this.data)
  }

}

export default SSTable
