import { CID } from 'multiformats'

export class DataDiff {
  adds: Record<string, DataAdd> = {}
  updates: Record<string, DataUpdate> = {}
  deletes: Record<string, DataDelete> = {}

  recordAdd(key: string, cid: CID): void {
    const del = this.deletes[key]
    if (del) {
      delete this.deletes[key]
      if (!del.cid.equals(cid)) {
        this.recordUpdate(key, del.cid, cid)
      }
    } else {
      this.adds[key] = { key, cid }
    }
  }

  recordUpdate(key: string, prev: CID, cid: CID): void {
    this.updates[key] = { key, prev, cid }
  }

  recordDelete(key: string, cid: CID): void {
    const add = this.adds[key]
    if (add) {
      delete this.adds[key]
      if (!add.cid.equals(cid)) {
        this.recordUpdate(key, cid, add.cid)
      }
    } else {
      this.deletes[key] = { key, cid }
    }
  }

  addDiff(diff: DataDiff) {
    for (const add of Object.values(diff.adds)) {
      this.recordAdd(add.key, add.cid)
    }
    for (const update of Object.values(diff.updates)) {
      this.recordUpdate(update.key, update.prev, update.cid)
    }
    for (const del of Object.values(diff.deletes)) {
      this.recordDelete(del.key, del.cid)
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
}

export type DataDelete = {
  key: string
  cid: CID
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
