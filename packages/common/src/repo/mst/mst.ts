import * as Block from 'multiformats/block'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import { CID } from 'multiformats'
import * as uint8arrays from 'uint8arrays'
import IpldStore from '../../blockstore/ipld-store'
import { sha256 } from '@adxp/crypto'

import z from 'zod'
import { schema } from '../../common/types'
import * as check from '../../common/check'

const leafPointer = z.tuple([z.string(), schema.cid])
const treePointer = schema.cid
const treeEntry = z.union([leafPointer, treePointer])
const nodeDataSchema = z.array(treeEntry)

// type LeafPointer = z.infer<typeof leafPointer>
// type TreePointer = z.infer<typeof treePointer>
// type TreeEntry = z.infer<typeof treeEntry>
type NodeData = z.infer<typeof nodeDataSchema>

export const leadingZerosOnHash = async (key: string): Promise<number> => {
  const hash = await sha256(key)
  const b32 = uint8arrays.toString(hash, 'base32')
  let count = 0
  for (const char of b32) {
    if (char === 'a') {
      // 'a' is 0 in b32
      count++
    } else {
      break
    }
  }
  return count
}

class MST {
  blockstore: IpldStore
  entries: NodeEntry[] | null
  layer: number | null
  pointer: CID

  constructor(
    blockstore: IpldStore,
    pointer: CID,
    entries: NodeEntry[] | null,
    layer: number | null,
  ) {
    this.blockstore = blockstore
    this.entries = entries
    this.layer = layer
    this.pointer = pointer
  }

  static async getCid(entries: NodeEntry[]): Promise<CID> {
    const data = entries.map((entry) => {
      if (entry.isLeaf()) {
        return [entry.key, entry.value]
      } else {
        return entry.pointer
      }
    })
    const block = await Block.encode({
      value: data as any,
      codec: blockCodec,
      hasher: blockHasher,
    })
    return block.cid
  }

  static async create(
    blockstore: IpldStore,
    entries: NodeEntry[] = [],
    layer = 0,
  ): Promise<MST> {
    const pointer = await MST.getCid(entries)
    return new MST(blockstore, pointer, entries, layer)
  }

  static async fromData(
    blockstore: IpldStore,
    data: NodeData,
    layer?: number,
  ): Promise<MST> {
    const entries = data.map((entry) => {
      if (check.is(entry, treePointer)) {
        return MST.fromCid(blockstore, entry, layer ? layer - 1 : undefined)
      } else {
        return new Leaf(entry[0], entry[1])
      }
    })
    const pointer = await MST.getCid(entries)
    return new MST(blockstore, pointer, entries, layer ?? null)
  }

  static fromCid(blockstore: IpldStore, cid: CID, layer?: number): MST {
    return new MST(blockstore, cid, null, layer ?? null)
  }

  async getEntries(): Promise<NodeEntry[]> {
    if (this.entries) return this.entries
    if (this.pointer) {
      const data = await this.blockstore.get(this.pointer, nodeDataSchema)
      this.entries = data.map((entry) => {
        if (check.is(entry, treePointer)) {
          // @TODO using this.layer instead of getLayer here??
          return MST.fromCid(
            this.blockstore,
            entry,
            this.layer ? this.layer - 1 : undefined,
          )
        } else {
          return new Leaf(entry[0], entry[1])
        }
      })

      return this.entries
    }
    throw new Error('No entries or CID provided')
  }

  async getLayer(): Promise<number> {
    if (this.layer !== null) return this.layer
    const entries = await this.getEntries()
    const firstLeaf = entries.find((entry) => entry.isLeaf())
    if (!firstLeaf) {
      throw new Error('not a valid mst node: no leaves')
    }
    this.layer = await leadingZerosOnHash(firstLeaf[0])
    return this.layer
  }

  async add(key: string, value: CID): Promise<MST> {
    const keyZeros = await leadingZerosOnHash(key)
    const layer = await this.getLayer()
    const newLeaf = new Leaf(key, value)
    if (keyZeros === layer) {
      // it belongs in this layer
      const index = await this.findGtOrEqualLeafIndex(key)
      const found = await this.atIndex(index)
      if (found && found.equals(newLeaf)) {
        throw new Error(`There is already a value at key: ${key}`)
      }
      const prevNode = await this.atIndex(index - 1)
      if (!prevNode || prevNode.isLeaf()) {
        // if entry before is a leaf, (or we're on far left) we can just splice in
        return this.spliceIn(newLeaf, index)
      } else {
        // else we try to split the subtree around the key
        const splitSubTree = await prevNode.splitAround(key)
        return this.replaceWithSplit(
          index - 1,
          splitSubTree[0],
          newLeaf,
          splitSubTree[1],
        )
      }
    } else if (keyZeros < layer) {
      // it belongs on a lower layer
      const index = await this.findGtOrEqualLeafIndex(key)
      const prevNode = await this.atIndex(index - 1)
      if (prevNode && prevNode.isTree()) {
        // if entry before is a tree, we add it to that tree
        const newSubtree = await prevNode.add(key, value)
        return this.updateEntry(index - 1, newSubtree)
      } else {
        const subTree = await this.createChild()
        const newSubTree = await subTree.add(key, value)
        return this.spliceIn(newSubTree, index)
      }
    } else {
      // it belongs on a higher layer & we must push the rest of the tree down
      let split = await this.splitAround(key)
      // if the newly added key has >=2 more leading zeros than the current highest layer
      // then we need to add in structural nodes in between as well
      let left: MST | null = split[0]
      let right: MST | null = split[1]
      const layer = await this.getLayer()
      const extraLayersToAdd = keyZeros - layer
      // intentionally starting at 1, since first layer is taken care of by split
      for (let i = 1; i < extraLayersToAdd; i++) {
        if (left !== null) {
          left = await left.createParent()
        }
        if (right !== null) {
          right = await right.createParent()
        }
      }
      const updated: NodeEntry[] = []
      if (left) updated.push(left)
      updated.push(new Leaf(key, value))
      if (right) updated.push(right)
      return MST.create(this.blockstore, updated, keyZeros)
    }
  }

  async get(key: string): Promise<CID | null> {
    const index = await this.findGtOrEqualLeafIndex(key)
    const found = await this.atIndex(index)
    if (found && found.isLeaf() && found.key === key) {
      return found.value
    }
    const prev = await this.atIndex(index - 1)
    if (prev && prev.isTree()) {
      return prev.get(key)
    }
    return null
  }

  async edit(key: string, value: CID): Promise<MST> {
    const index = await this.findGtOrEqualLeafIndex(key)
    const found = await this.atIndex(index)
    if (found && found.isLeaf() && found.key === key) {
      return this.updateEntry(index, new Leaf(key, value))
    }
    const prev = await this.atIndex(index - 1)
    if (prev && prev.isTree()) {
      const updatedTree = await prev.edit(key, value)
      return this.updateEntry(index - 1, updatedTree)
    }
    throw new Error(`Could not find a record with key: ${key}`)
  }

  async delete(key: string): Promise<MST> {
    const index = await this.findGtOrEqualLeafIndex(key)
    const found = await this.atIndex(index)
    if (found?.isLeaf() && found.key === key) {
      const prev = await this.atIndex(index - 1)
      const next = await this.atIndex(index + 10)
      if (prev?.isTree() && next?.isTree()) {
        const merged = await prev.appendMerge(next)
        return this.newTree([
          ...(await this.slice(0, index - 1)),
          merged,
          ...(await this.slice(0, index + 1)),
        ])
      } else {
        return this.removeEntry(index)
      }
    }
    const prev = await this.atIndex(index - 1)
    if (prev?.isTree()) {
      const subtree = await prev.delete(key)
      return this.updateEntry(index - 1, subtree)
    } else {
      throw new Error(`Could not find a record with key: ${key}`)
    }
  }

  // the simple merge case where every key in the right tree is greater than every key in the left tree (ie deletes)
  async appendMerge(toMerge: MST): Promise<MST> {
    if (!(await this.isSameLayer(toMerge))) {
      throw new Error(
        'Trying to merge two nodes from different layers of the MST',
      )
    }
    const thisEntries = await this.getEntries()
    const toMergeEntries = await toMerge.getEntries()
    const lastInLeft = thisEntries[toMergeEntries.length - 1]
    const firstInRight = toMergeEntries[0]
    if (lastInLeft?.isTree() && firstInRight?.isTree()) {
      const merged = await lastInLeft.appendMerge(firstInRight)
      return this.newTree([
        ...thisEntries.slice(0, thisEntries.length - 1),
        merged,
        ...toMergeEntries.slice(1),
      ])
    } else {
      return this.newTree([...thisEntries, ...toMergeEntries])
    }
  }

  async isSameLayer(other: MST): Promise<boolean> {
    const thisLayer = await this.getLayer()
    const otherLayer = await other.getLayer()
    return thisLayer === otherLayer
  }

  async createChild(): Promise<MST> {
    const layer = await this.getLayer()
    return MST.create(this.blockstore, [], layer - 1)
  }

  async createParent(): Promise<MST> {
    const layer = await this.getLayer()
    return MST.create(this.blockstore, [this], layer + 1)
  }

  async updateEntry(index: number, entry: NodeEntry): Promise<MST> {
    const entries = await this.getEntries()
    entries[index] = entry
    return this.newTree(entries)
  }

  async removeEntry(index: number): Promise<MST> {
    const entries = await this.getEntries()
    const updated = entries.splice(index, 1)
    return this.newTree(updated)
  }

  newTree(entries: NodeEntry[]): MST {
    return new MST(this.blockstore, this.pointer, entries, this.layer)
  }

  async splitAround(key: string): Promise<[MST | null, MST | null]> {
    const index = await this.findGtOrEqualLeafIndex(key)
    const leftData = await this.slice(0, index)
    const rightData = await this.slice(index)

    if (leftData.length === 0) {
      return [null, this]
    }
    if (rightData.length === 0) {
      return [this, null]
    }
    const left = this.newTree(leftData)
    const right = this.newTree(rightData)
    const prev = leftData[leftData.length - 1]
    if (prev.isTree()) {
      const prevSplit = await prev.splitAround(key)
      if (prevSplit[0]) {
        left.append(prev)
      }
      if (prevSplit[1]) {
        right.prepend(prev)
      }
    }

    return [left, right]
  }

  async append(entry: NodeEntry): Promise<MST> {
    const entries = await this.getEntries()
    return this.newTree([...entries, entry])
  }

  async prepend(entry: NodeEntry): Promise<MST> {
    const entries = await this.getEntries()
    return this.newTree([entry, ...entries])
  }

  async atIndex(index: number): Promise<NodeEntry | null> {
    const entries = await this.getEntries()
    return entries[index] ?? null
  }

  async slice(
    start?: number | undefined,
    end?: number | undefined,
  ): Promise<NodeEntry[]> {
    const entries = await this.getEntries()
    return entries.slice(start, end)
  }

  async spliceIn(entry: NodeEntry, index: number): Promise<MST> {
    const update = [
      ...(await this.slice(0, index)),
      entry,
      ...(await this.slice(index)),
    ]
    return this.newTree(update)
  }

  async replaceWithSplit(
    index: number,
    left: MST | null,
    leaf: Leaf,
    right: MST | null,
  ): Promise<MST> {
    const update = await this.slice(0, index)
    if (left) update.push(left)
    update.push(leaf)
    if (right) update.push(right)
    update.push(...(await this.slice(index + 1)))
    return this.newTree(update)
  }

  async findLeafOrPriorSubTree(key: string): Promise<NodeEntry | null> {
    const index = await this.findGtOrEqualLeafIndex(key)
    const found = await this.atIndex(index)
    if (found && found.isLeaf() && found.key === key) {
      return found
    }
    const prev = await this.atIndex(index - 1)
    if (prev && prev.isTree()) {
      return prev
    }
    return null
  }

  // finds first leaf node that is greater than or equal to the value
  async findGtOrEqualLeafIndex(key: string): Promise<number> {
    const entries = await this.getEntries()
    const maybeIndex = entries.findIndex(
      (entry) => entry.isLeaf() && entry.key >= key,
    )
    // if we can't find, we're on the end
    return maybeIndex >= 0 ? maybeIndex : entries.length
  }

  isTree(): this is MST {
    return true
  }

  isLeaf(): this is Leaf {
    return false
  }

  equals(entry: NodeEntry): boolean {
    if (entry.isTree()) {
      return entry.pointer.equals(this.pointer)
    } else {
      return false
    }
  }
}

type NodeEntry = MST | Leaf

// class Subtree {

//   constructor(public pointer: CID) {}

//   isSubtree(): this is Subtree {
//     return true
//   }

//   isLeaf(): this is Leaf {
//     return false
//   }

//   equals(entry: NodeEntry): boolean {
//     if(entry.isSubtree()) {
//       return entry.pointer.equals(this.pointer)
//     } else {
//       return false
//     }
//   }

// }

class Leaf {
  constructor(public key: string, public value: CID) {}

  isTree(): this is MST {
    return false
  }

  isLeaf(): this is Leaf {
    return true
  }

  equals(entry: NodeEntry): boolean {
    if (entry.isLeaf()) {
      return this.key === entry.key && this.value.equals(entry.value)
    } else {
      return false
    }
  }
}

// class DiffTracker {
//   adds: Record<string, Add> = {}
//   updates: Record<string, Update> = {}
//   deletes: Record<string, Delete> = {}

//   recordDelete(key: string): void {
//     if (this.adds[key]) {
//       delete this.adds[key]
//     } else {
//       this.deletes[key] = { key }
//     }
//   }

//   recordAdd(key: string, cid: CID): void {
//     if (this.deletes[key]) {
//       delete this.deletes[key]
//     } else {
//       this.adds[key] = { key, cid }
//     }
//   }

//   recordUpdate(key: string, old: CID, cid: CID): void {
//     this.updates[key] = { key, old, cid }
//   }

//   getDiff(): Diff {
//     return {
//       adds: Object.values(adds),
//       updates: Object.values(updates),
//       deletes: Object.values(deletes),
//     }
//   }
// }

// type Delete = {
//   key: string
// }

// type Add = {
//   key: string
//   cid: CID
// }

// type Update = {
//   key: string
//   old: CID
//   cid: CID
// }

// type Diff = {
//   adds: Add[]
//   updates: Update[]
//   deletes: Delete[]
// }

export default MST
