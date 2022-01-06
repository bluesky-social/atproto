import * as car from '@ipld/car'
import { CarWriter } from '@ipld/car'
import { BlockWriter } from '@ipld/car/lib/writer-browser'
import { CID } from 'multiformats/cid'
import { flattenUint8Arrays } from './util'

export class MemoryDB {

  map: Map<string, any>

  constructor() {
    this.map = new Map()
  }

  async get(k: CID) {
    return this.map.get(k.toString())
  }

  async put(k: CID, v: Uint8Array) {
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
    const arrays = []
    for await (const chunk of this.getCarStream(root)) {
      arrays.push(chunk)
    }
    return flattenUint8Arrays(arrays)
  }

}

export default MemoryDB
