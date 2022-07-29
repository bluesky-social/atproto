import { CID } from 'multiformats'

export class MstDiff {
  adds: Record<string, MstAdd> = {}
  updates: Record<string, MstUpdate> = {}
  deletes: Record<string, MstDelete> = {}

  recordAdd(key: string, cid: CID): void {
    if (this.deletes[key]) {
      delete this.deletes[key]
    } else {
      this.adds[key] = { key, cid }
    }
  }

  recordUpdate(key: string, old: CID, cid: CID): void {
    this.updates[key] = { key, old, cid }
  }

  recordDelete(key: string): void {
    if (this.adds[key]) {
      delete this.adds[key]
    } else {
      this.deletes[key] = { key }
    }
  }

  addDiff(diff: MstDiff) {
    for (const add of Object.values(diff.adds)) {
      this.recordAdd(add.key, add.cid)
    }
    for (const update of Object.values(diff.updates)) {
      this.recordUpdate(update.key, update.old, update.cid)
    }
    for (const del of Object.values(diff.deletes)) {
      this.recordDelete(del.key)
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
}

export type MstAdd = {
  key: string
  cid: CID
}

export type MstUpdate = {
  key: string
  old: CID
  cid: CID
}
