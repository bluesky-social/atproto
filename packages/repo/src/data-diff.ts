import { Cid } from '@atproto/lex-data'
import { BlockMap } from './block-map'
import { CidSet } from './cid-set'
import { MST, NodeEntry, mstDiff } from './mst'

export class DataDiff {
  adds: Record<string, DataAdd> = {}
  updates: Record<string, DataUpdate> = {}
  deletes: Record<string, DataDelete> = {}

  newMstBlocks: BlockMap = new BlockMap()
  newLeafCids: CidSet = new CidSet()
  removedCids: CidSet = new CidSet()

  static async of(curr: MST, prev: MST | null): Promise<DataDiff> {
    return mstDiff(curr, prev)
  }

  async nodeAdd(node: NodeEntry) {
    if (node.isLeaf()) {
      this.leafAdd(node.key, node.value)
    } else {
      const data = await node.serialize()
      this.treeAdd(data.cid, data.bytes)
    }
  }

  async nodeDelete(node: NodeEntry) {
    if (node.isLeaf()) {
      const key = node.key
      const cid = node.value
      this.deletes[key] = { key, cid }
      this.removedCids.add(cid)
    } else {
      const cid = await node.getPointer()
      this.treeDelete(cid)
    }
  }

  leafAdd(key: string, cid: Cid) {
    this.adds[key] = { key, cid }
    if (this.removedCids.has(cid)) {
      this.removedCids.delete(cid)
    } else {
      this.newLeafCids.add(cid)
    }
  }

  leafUpdate(key: string, prev: Cid, cid: Cid) {
    if (prev.equals(cid)) return
    this.updates[key] = { key, prev, cid }
    this.removedCids.add(prev)
    this.newLeafCids.add(cid)
  }

  leafDelete(key: string, cid: Cid) {
    this.deletes[key] = { key, cid }
    if (this.newLeafCids.has(cid)) {
      this.newLeafCids.delete(cid)
    } else {
      this.removedCids.add(cid)
    }
  }

  treeAdd(cid: Cid, bytes: Uint8Array) {
    if (this.removedCids.has(cid)) {
      this.removedCids.delete(cid)
    } else {
      this.newMstBlocks.set(cid, bytes)
    }
  }

  treeDelete(cid: Cid) {
    if (this.newMstBlocks.has(cid)) {
      this.newMstBlocks.delete(cid)
    } else {
      this.removedCids.add(cid)
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
  cid: Cid
}

export type DataUpdate = {
  key: string
  prev: Cid
  cid: Cid
}

export type DataDelete = {
  key: string
  cid: Cid
}
