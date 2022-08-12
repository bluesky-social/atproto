import { CID } from 'multiformats'

export class MstDiff {
  adds: Record<string, MstAdd> = {}
  updates: Record<string, MstUpdate> = {}
  deletes: Record<string, MstDelete> = {}

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

  addDiff(diff: MstDiff) {
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

  addList(): MstAdd[] {
    return Object.values(this.adds)
  }

  updateList(): MstUpdate[] {
    return Object.values(this.updates)
  }

  deleteList(): MstDelete[] {
    return Object.values(this.deletes)
  }
}

export type MstDelete = {
  key: string
  cid: CID
}

export type MstAdd = {
  key: string
  cid: CID
}

export type MstUpdate = {
  key: string
  prev: CID
  cid: CID
}
