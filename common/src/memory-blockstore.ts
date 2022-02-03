import { CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import { CID } from 'multiformats/cid'
import { BlockstoreI } from './types.js'
import { streamToArray } from './util.js'

export class MemoryBlockstore implements BlockstoreI {

  map: Map<string, any>

  constructor() {
    this.map = new Map()
  }

  async get(k: CID): Promise<Uint8Array> {
    const v = this.map.get(k.toString())
    if (!v) throw new Error(`Not found: ${k.toString()}`)
    return v
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

export default MemoryBlockstore
