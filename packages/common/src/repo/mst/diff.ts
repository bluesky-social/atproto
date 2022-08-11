import * as auth from '@adxp/auth'
import { CID } from 'multiformats'
import CidSet from '../cid-set'

export class DataDiff {
  adds: Record<string, DataAdd> = {}
  updates: Record<string, DataUpdate> = {}
  deletes: Record<string, DataDelete> = {}

  newCids: CidSet = new CidSet()

  recordAdd(key: string, cid: CID): void {
    this.adds[key] = { key, cid }
    this.newCids.add(cid)
  }

  recordUpdate(key: string, prev: CID, cid: CID): void {
    this.updates[key] = { key, prev, cid }
    this.newCids.add(cid)
  }

  recordDelete(key: string, cid: CID): void {
    this.deletes[key] = { key, cid }
  }

  recordNewCid(cid: CID): void {
    this.newCids.add(cid)
  }

  addList(): DataAdd[] {
    return Object.values(this.adds)
  }

  updateList(): DataUpdate[] {
    return Object.values(this.updates)
  }

  deleteList(): DataDelete[] {
    return Object.values(this.deletes)
  }

  newCidList(): CID[] {
    return this.newCids.toList()
  }

  updatedKeys(): string[] {
    const keys = [
      ...Object.keys(this.adds),
      ...Object.keys(this.updates),
      ...Object.keys(this.deletes),
    ]
    return [...new Set(keys)]
  }

  neededCapabilities(rootDid: string): auth.ucans.Capability[] {
    return this.updatedKeys().map((key) => {
      const parts = key.split('/')
      if (parts.length !== 3) {
        throw new Error(`Invalid record id: ${key}`)
      }
      return auth.writeCap(rootDid, parts[0], parts[1], parts[2])
    })
  }
}

export type DataAdd = {
  key: string
  cid: CID
}

export type DataUpdate = {
  key: string
  prev: CID
  cid: CID
}

export type DataDelete = {
  key: string
  cid: CID
}
