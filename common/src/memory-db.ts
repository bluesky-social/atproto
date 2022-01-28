import { CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import { CID } from 'multiformats/cid'
import { streamToArray } from './util'

let globalDB: MemoryDB | null = null
export class MemoryDB {

  map: Map<string, any>

  constructor() {
    this.map = new Map()
  }

  static getGlobal(): MemoryDB {
    if (globalDB === null) {
      globalDB = new MemoryDB()
    }
    return globalDB
  }

  async get(k: CID): Promise<Uint8Array> {
    return this.map.get(k.toString())
  }

  async put(k: CID, v: Uint8Array): Promise<void> {
    this.map.set(k.toString(), v)
  }

  getCarStream(root: CID): AsyncIterable<Uint8Array> {
    const writeDB = async (car: BlockWriter) => {
      for await (const [cid, bytes] of this.map.entries()) {
        car.put({ cid: CID.parse(cid), bytes })
      }
      car.close()
    }

    const { writer, out } = CarWriter.create([root])
    writeDB(writer)
    return out
  }

  async getCarFile(root: CID): Promise<Uint8Array> {
    return streamToArray(this.getCarStream(root))
  }

}

export default MemoryDB
