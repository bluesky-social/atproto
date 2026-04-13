import { Cid } from '@atproto/lex-data'
import { BlockMap } from './block-map'
import { CidSet } from './cid-set'
import { MST, NodeEntry, mstDiff } from './mst'
import { PREORDER_MAX_DEPTH, PreorderOp } from './types'

export class DataDiff {
  adds: Record<string, DataAdd> = {}
  updates: Record<string, DataUpdate> = {}
  deletes: Record<string, DataDelete> = {}

  newMstBlocks: BlockMap = new BlockMap()
  newLeafCids: CidSet = new CidSet()
  removedCids: CidSet = new CidSet()
  preorderOps: PreorderOp[] = []

  static async of(curr: MST, prev: MST | null): Promise<DataDiff> {
    return mstDiff(curr, prev)
  }

  async nodeAdd(node: NodeEntry, lpath: string, layer: number) {
    if (node.isLeaf()) {
      this.leafAdd(node.key, node.value)
    } else {
      const data = await node.serialize()
      this.treeAdd(data.cid, data.bytes)
      this.preorderOps.push({
        action: 'insert',
        lpath,
        depth: PREORDER_MAX_DEPTH - layer,
        cid: node.pointer.toString(),
      })
    }
  }

  async nodeDelete(node: NodeEntry, lpath: string, layer: number) {
    if (node.isLeaf()) {
      this.leafDelete(node.key, node.value)
    } else {
      const cid = await node.getPointer()
      this.treeDelete(cid)
      this.preorderOps.push({
        action: 'delete',
        lpath,
        depth: PREORDER_MAX_DEPTH - layer,
      })
    }
  }

  nodeUpdatePreorder(
    node: MST,
    oldLpath: string,
    newLpath: string,
    layer: number,
  ) {
    const depth = PREORDER_MAX_DEPTH - layer
    this.preorderOps.push(
      { action: 'delete', lpath: oldLpath, depth },
      {
        action: 'insert',
        lpath: newLpath,
        depth,
        cid: node.pointer.toString(),
      },
    )
  }

  leafAdd(key: string, cid: Cid) {
    this.adds[key] = { key, cid }
    if (this.removedCids.has(cid)) {
      this.removedCids.delete(cid)
    } else {
      this.newLeafCids.add(cid)
    }
    this.preorderOps.push({
      action: 'insert',
      lpath: key,
      depth: 0,
      cid: cid.toString(),
    })
  }

  leafUpdate(key: string, prev: Cid, cid: Cid) {
    if (prev.equals(cid)) return
    this.updates[key] = { key, prev, cid }
    this.removedCids.add(prev)
    this.newLeafCids.add(cid)
    this.preorderOps.push(
      { action: 'delete', lpath: key, depth: 0 },
      { action: 'insert', lpath: key, depth: 0, cid: cid.toString() },
    )
  }

  leafDelete(key: string, cid: Cid) {
    this.deletes[key] = { key, cid }
    if (this.newLeafCids.has(cid)) {
      this.newLeafCids.delete(cid)
    } else {
      this.removedCids.add(cid)
    }
    this.preorderOps.push({ action: 'delete', lpath: key, depth: 0 })
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
