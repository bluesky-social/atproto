import { CID } from 'multiformats'
import { BlockMap } from './block-map'
import { CidSet } from './cid-set'
import { MST, MstDiffOpts, NodeEntry, mstDiff } from './mst'
import { PreorderOp } from './types'

export class DataDiff {
  adds: Record<string, DataAdd> = {}
  updates: Record<string, DataUpdate> = {}
  deletes: Record<string, DataDelete> = {}

  newMstBlocks: BlockMap = new BlockMap()
  newLeafCids: CidSet = new CidSet()
  removedCids: CidSet = new CidSet()
  preorderOps: PreorderOp[] | null

  constructor(opts?: { trackPreorder?: boolean }) {
    this.preorderOps = opts?.trackPreorder ? [] : null
  }

  static async of(
    curr: MST,
    prev: MST | null,
    opts?: MstDiffOpts,
  ): Promise<DataDiff> {
    return mstDiff(curr, prev, opts)
  }

  get trackPreorder(): boolean {
    return this.preorderOps !== null
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

  // Preorder tracking: emit insert op for a node (no-op if not tracking)
  async preorderInsert(node: NodeEntry, lpath: string): Promise<void> {
    if (!this.preorderOps) return
    if (node.isTree()) {
      const layer = await node.getLayer()
      this.preorderOps.push({
        action: 'insert',
        lpath,
        depth: 129 - layer,
        cid: node.pointer.toString(),
      })
    } else {
      this.preorderOps.push({
        action: 'insert',
        lpath: node.key,
        depth: 0,
        cid: node.value.toString(),
      })
    }
  }

  // Preorder tracking: emit delete op for a node (no-op if not tracking)
  async preorderDelete(node: NodeEntry, lpath: string): Promise<void> {
    if (!this.preorderOps) return
    if (node.isTree()) {
      const layer = await node.getLayer()
      this.preorderOps.push({
        action: 'delete',
        lpath,
        depth: 129 - layer,
      })
    } else {
      this.preorderOps.push({
        action: 'delete',
        lpath: node.key,
        depth: 0,
      })
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
