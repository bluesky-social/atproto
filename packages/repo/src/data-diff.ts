import { CID } from 'multiformats'
import CidSet from './cid-set'
import { MST, NodeEntry, mstDiff } from './mst'
import BlockMap from './block-map'

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

  leafAdd(key: string, cid: CID) {
    this.adds[key] = { key, cid }
    if (this.removedCids.has(cid)) {
      this.removedCids.delete(cid)
    } else {
      this.newLeafCids.add(cid)
    }
  }

  leafUpdate(key: string, prev: CID, cid: CID) {
    if (prev.equals(cid)) return
    this.updates[key] = { key, prev, cid }
    this.removedCids.add(prev)
    this.newLeafCids.add(cid)
  }

  leafDelete(key: string, cid: CID) {
    this.deletes[key] = { key, cid }
    if (this.newLeafCids.has(cid)) {
      this.newLeafCids.delete(cid)
    } else {
      this.removedCids.add(cid)
    }
  }

  treeAdd(cid: CID, bytes: Uint8Array) {
    if (this.removedCids.has(cid)) {
      this.removedCids.delete(cid)
    } else {
      this.newMstBlocks.set(cid, bytes)
    }
  }

  treeDelete(cid: CID) {
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
