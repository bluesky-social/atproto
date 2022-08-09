import * as auth from '@adxp/auth'
import { CID } from 'multiformats'
import CidSet from '../cid-set'
import { Leaf, NodeEntry } from './mst'

export class DataDiff {
  adds: Record<string, DataAdd> = {}
  updates: Record<string, DataUpdate> = {}
  deletes: Record<string, DataDelete> = {}

  cidsLeft: CidSet = new CidSet()
  cidsRight: CidSet = new CidSet()

  recordAdd(entry: NodeEntry): void {
    let cid
    if (entry.isLeaf()) {
      cid = entry.value
      const key = entry.key
      const del = this.deletes[key]
      if (del) {
        delete this.deletes[key]
        if (!del.cid.equals(cid)) {
          this.recordUpdate(key, del.cid, cid)
        }
      } else {
        this.adds[key] = { key, cid }
      }
    } else {
      cid = entry.pointer
    }
    this.recordAddedCid(cid)
  }

  recordUpdate(key: string, prev: CID, cid: CID): void {
    this.updates[key] = { key, prev, cid }
    this.recordAddedCid(cid)
    this.recordDeletedCid(prev)
  }

  recordDelete(entry: NodeEntry): void {
    let cid
    if (entry.isLeaf()) {
      cid = entry.value
      const key = entry.key
      const add = this.adds[key]
      if (add) {
        delete this.adds[key]
        if (!add.cid.equals(cid)) {
          this.recordUpdate(key, cid, add.cid)
        }
      } else {
        this.deletes[key] = { key, cid }
      }
    } else {
      cid = entry.pointer
    }
    this.recordDeletedCid(cid)
  }

  recordAddedCid(cid: CID): void {
    if (this.cidsLeft.has(cid)) {
      this.cidsLeft.delete(cid)
    } else {
      this.cidsRight.add(cid)
    }
  }

  recordDeletedCid(cid: CID): void {
    if (this.cidsRight.has(cid)) {
      this.cidsRight.delete(cid)
    } else {
      this.cidsLeft.add(cid)
    }
  }

  addDiff(diff: DataDiff) {
    for (const add of diff.addList()) {
      this.recordAdd(new Leaf(add.key, add.cid))
    }
    for (const update of diff.updateList()) {
      this.recordUpdate(update.key, update.prev, update.cid)
    }
    for (const del of diff.deleteList()) {
      this.recordDelete(new Leaf(del.key, del.cid))
    }

    for (const cid of diff.cidsLeft.toList()) {
      this.recordAddedCid(cid)
    }
    for (const cid of diff.cidsRight.toList()) {
      this.recordDeletedCid(cid)
    }
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

  cidsForDiff(): CID[] {
    return this.cidsRight.toList()
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
      const split = key.split('/')
      const tid = split[1]
      if (tid === undefined) throw new Error(`Invalid record id: ${key}`)
      const collection = split.slice(0, -1).join('/')
      return auth.writeCap(rootDid, collection, tid)
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
