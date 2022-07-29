import { CID } from 'multiformats'

export class Diff {
  adds: Record<string, Add> = {}
  updates: Record<string, Update> = {}
  deletes: Record<string, Delete> = {}

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

  addDiff(diff: Diff) {
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
}

export type Delete = {
  key: string
}

export type Add = {
  key: string
  cid: CID
}

export type Update = {
  key: string
  old: CID
  cid: CID
}
