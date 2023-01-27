import { CID } from 'multiformats'
import CidSet from './cid-set'
import { MST, mstDiff } from './mst'
import { DataStore } from './types'

export class DataDiff {
  adds: Record<string, DataAdd> = {}
  updates: Record<string, DataUpdate> = {}
  deletes: Record<string, DataDelete> = {}

  newCids: CidSet = new CidSet()

  static async of(curr: DataStore, prev: DataStore | null): Promise<DataDiff> {
    if (curr instanceof MST && (prev === null || prev instanceof MST)) {
      return mstDiff(curr, prev)
    }
    throw new Error('Unsupported DataStore type for diff')
  }

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

  addDiff(diff: DataDiff) {
    for (const add of diff.addList()) {
      if (this.deletes[add.key]) {
        const del = this.deletes[add.key]
        if (del.cid !== add.cid) {
          this.recordUpdate(add.key, del.cid, add.cid)
        }
        delete this.deletes[add.key]
      } else {
        this.recordAdd(add.key, add.cid)
      }
    }
    for (const update of diff.updateList()) {
      this.recordUpdate(update.key, update.prev, update.cid)
      delete this.adds[update.key]
      delete this.deletes[update.key]
    }
    for (const del of diff.deleteList()) {
      if (this.adds[del.key]) {
        delete this.adds[del.key]
      } else {
        delete this.updates[del.key]
        this.recordDelete(del.key, del.cid)
      }
    }
    this.newCids.addSet(diff.newCids)
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

export default DataDiff
