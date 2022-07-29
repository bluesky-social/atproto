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
import { MstDiff } from './diff'

// Description of the data in the actual CBOR-encoded blocks
const leafPointer = z.tuple([z.string(), schema.cid])
const treePointer = schema.cid
const treeEntry = z.union([leafPointer, treePointer])
export const nodeDataSchema = z.array(treeEntry)
export type NodeData = z.infer<typeof nodeDataSchema>

export type NodeEntry = MST | Leaf

export class MST {
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

  static async create(
    blockstore: IpldStore,
    entries: NodeEntry[] = [],
    layer = 0,
  ): Promise<MST> {
    const pointer = await getCidForEntries(entries)
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
    const pointer = await getCidForEntries(entries)
    return new MST(blockstore, pointer, entries, layer ?? null)
  }

  static fromCid(blockstore: IpldStore, cid: CID, layer?: number): MST {
    return new MST(blockstore, cid, null, layer ?? null)
  }

  // Immutability
  // -------------------

  // We never mutate an MST, we just return a new MST with updated values
  async newTree(entries: NodeEntry[]): Promise<MST> {
    const pointer = await getCidForEntries(entries)
    return new MST(this.blockstore, pointer, entries, this.layer)
  }

  // Getters (lazy load)
  // -------------------

  // We don't want to load entries of every subtree, just the ones we need
  async getEntries(): Promise<NodeEntry[]> {
    if (this.entries) return [...this.entries]
    if (this.pointer) {
      const data = await this.blockstore.get(this.pointer, nodeDataSchema)
      const firstLeaf = data.filter((e) => check.is(e, leafPointer))
      const layer =
        firstLeaf[0] !== undefined
          ? await leadingZerosOnHash(firstLeaf[0][0])
          : null
      this.entries = data.map((entry) => {
        if (check.is(entry, treePointer)) {
          return MST.fromCid(
            this.blockstore,
            entry,
            layer ? layer - 1 : undefined,
          )
        } else {
          return new Leaf(entry[0], entry[1])
        }
      })

      return this.entries
    }
    throw new Error('No entries or CID provided')
  }

  // We should be able to find the layer of a node by either a hint on creation or by looking at the first leaf
  // If we have neither a hint nor a leaf, we throw an error
  // We could recurse to find the layer, but it isn't necessary for any of our current operations
  async getLayer(): Promise<number> {
    if (this.layer !== null) return this.layer
    const entries = await this.getEntries()
    const layer = await layerForEntries(entries)
    if (!layer) {
      throw new Error('Could not find layer for tree')
    }
    this.layer = layer
    return this.layer
  }

  // Core functionality
  // -------------------

  // Persist the MST to the blockstore
  async save(): Promise<CID> {
    const alreadyHas = await this.blockstore.has(this.pointer)
    if (alreadyHas) return this.pointer
    const entries = await this.getEntries()
    const data = entriesToData(entries)
    await this.blockstore.put(data as any)
    for (const entry of entries) {
      if (entry.isTree()) {
        await entry.save()
      }
    }
    return this.pointer
  }

  // Adds a new leaf for the given key/value pair
  // Throws if a leaf with that key already exists
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

  // Gets the value at the given key
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

  // Edits the value at the given key
  // Throws if the given key does not exist
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

  // Deletes the value at the given key
  async delete(key: string): Promise<MST> {
    const index = await this.findGtOrEqualLeafIndex(key)
    const found = await this.atIndex(index)
    // if found, remove it on this level
    if (found?.isLeaf() && found.key === key) {
      const prev = await this.atIndex(index - 1)
      const next = await this.atIndex(index + 1)
      if (prev?.isTree() && next?.isTree()) {
        const merged = await prev.appendMerge(next)
        return this.newTree([
          ...(await this.slice(0, index - 1)),
          merged,
          ...(await this.slice(index + 2)),
        ])
      } else {
        return this.removeEntry(index)
      }
    }
    // else recurse down to find it
    const prev = await this.atIndex(index - 1)
    if (prev?.isTree()) {
      const subtree = await prev.delete(key)
      return this.updateEntry(index - 1, subtree)
    } else {
      throw new Error(`Could not find a record with key: ${key}`)
    }
  }

  // Finds the semantic changes between two MSTs
  // This uses a stateful diff tracker that will sometimes record encountered leaves
  // before removing them later when they're encountered in the other tree
  async diff(other: MST): Promise<MstDiff> {
    const diff = new MstDiff()
    let leftI = 0
    let rightI = 0
    const leftEntries = await this.getEntries()
    const rightEntries = await other.getEntries()
    while (leftI < leftEntries.length || rightI < rightEntries.length) {
      const left = leftEntries[leftI]
      const right = rightEntries[rightI]
      if (!left && !right) {
        // shouldn't ever reach this, but if both are null, we break
        break
      } else if (!left) {
        // if no left, record a right leaf as an add, or add all leaves in the right subtree
        if (right.isLeaf()) {
          diff.recordAdd(right.key, right.value)
        } else {
          const allChildren = await right.leaves()
          for (const leaf of allChildren) {
            diff.recordAdd(leaf.key, leaf.value)
          }
        }
        rightI++
      } else if (!right) {
        // if no right, record a left leaf as an del, or del all leaves in the left subtree
        if (left.isLeaf()) {
          diff.recordDelete(left.key)
        } else {
          const allChildren = await left.leaves()
          for (const leaf of allChildren) {
            diff.recordDelete(leaf.key)
          }
        }
        leftI++
      } else if (left.isLeaf() && right.isLeaf()) {
        // if both are leaves, check if they're the same key
        // if they're equal, move on. if the value is changed, record update
        // if they're different, record the smaller one & increment that side
        if (left.key === right.key) {
          if (!left.value.equals(right.value)) {
            diff.recordUpdate(left.key, left.value, right.value)
          }
          leftI++
          rightI++
        } else if (left.key < right.key) {
          diff.recordDelete(left.key)
          leftI++
        } else {
          diff.recordAdd(right.key, right.value)
          rightI++
        }
      } else if (left.isTree() && right.isTree()) {
        // if both are trees, find the diff of those trees
        if (!left.equals(right)) {
          const subDiff = await left.diff(right)
          diff.addDiff(subDiff)
        }
        leftI++
        rightI++
      } else if (left.isLeaf() && right.isTree()) {
        // if one is a leaf & one is a tree, record the leaf and increment that side
        diff.recordDelete(left.key)
        leftI++
      } else if (left.isTree() && right.isLeaf()) {
        diff.recordAdd(right.key, right.value)
        rightI++
      }
    }
    return diff
  }

  // Simple Operations
  // -------------------

  // update entry in place
  async updateEntry(index: number, entry: NodeEntry): Promise<MST> {
    const update = [
      ...(await this.slice(0, index)),
      entry,
      ...(await this.slice(index + 1)),
    ]
    return this.newTree(update)
  }

  // remove entry at index
  async removeEntry(index: number): Promise<MST> {
    const updated = [
      ...(await this.slice(0, index)),
      ...(await this.slice(index + 1)),
    ]
    return this.newTree(updated)
  }

  // append entry to end of the node
  async append(entry: NodeEntry): Promise<MST> {
    const entries = await this.getEntries()
    return this.newTree([...entries, entry])
  }

  // prepend entry to start of the node
  async prepend(entry: NodeEntry): Promise<MST> {
    const entries = await this.getEntries()
    return this.newTree([entry, ...entries])
  }

  // returns entry at index
  async atIndex(index: number): Promise<NodeEntry | null> {
    const entries = await this.getEntries()
    return entries[index] ?? null
  }

  // returns a slice of the node (like array.slice)
  async slice(
    start?: number | undefined,
    end?: number | undefined,
  ): Promise<NodeEntry[]> {
    const entries = await this.getEntries()
    return entries.slice(start, end)
  }

  // inserts entry at index
  async spliceIn(entry: NodeEntry, index: number): Promise<MST> {
    const update = [
      ...(await this.slice(0, index)),
      entry,
      ...(await this.slice(index)),
    ]
    return this.newTree(update)
  }

  // replaces an entry with [ Maybe(tree), Leaf, Maybe(tree) ]
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

  // Subtree & Splits
  // -------------------

  // Recursively splits a sub tree around a given key
  async splitAround(key: string): Promise<[MST | null, MST | null]> {
    const index = await this.findGtOrEqualLeafIndex(key)
    // split tree around key
    const leftData = await this.slice(0, index)
    const rightData = await this.slice(index)
    let left = await this.newTree(leftData)
    let right = await this.newTree(rightData)

    // if the far right of the left side is a subtree,
    // we need to split it on the key as well
    const lastInLeft = leftData[leftData.length - 1]
    if (lastInLeft?.isTree()) {
      left = await left.removeEntry(leftData.length - 1)
      const split = await lastInLeft.splitAround(key)
      if (split[0]) {
        left = await left.append(split[0])
      }
      if (split[1]) {
        right = await right.prepend(split[1])
      }
    }

    return [
      (await left.getEntries()).length > 0 ? left : null,
      (await right.getEntries()).length > 0 ? right : null,
    ]
  }

  // The simple merge case where every key in the right tree is greater than every key in the left tree
  // (used primarily for deletes)
  async appendMerge(toMerge: MST): Promise<MST> {
    if ((await this.getLayer()) !== (await toMerge.getLayer())) {
      throw new Error(
        'Trying to merge two nodes from different layers of the MST',
      )
    }
    const thisEntries = await this.getEntries()
    const toMergeEntries = await toMerge.getEntries()
    const lastInLeft = thisEntries[thisEntries.length - 1]
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

  // Create relatives
  // -------------------

  async createChild(): Promise<MST> {
    const layer = await this.getLayer()
    return MST.create(this.blockstore, [], layer - 1)
  }

  async createParent(): Promise<MST> {
    const layer = await this.getLayer()
    return MST.create(this.blockstore, [this], layer + 1)
  }

  // Finding insertion points
  // -------------------

  // finds index of first leaf node that is greater than or equal to the value
  async findGtOrEqualLeafIndex(key: string): Promise<number> {
    const entries = await this.getEntries()
    const maybeIndex = entries.findIndex(
      (entry) => entry.isLeaf() && entry.key >= key,
    )
    // if we can't find, we're on the end
    return maybeIndex >= 0 ? maybeIndex : entries.length
  }

  // Full tree traversal
  // -------------------

  // Walk full tree & emit nodes, consumer can bail at any point by returning false
  async walk(fn: (entry: NodeEntry) => boolean | Promise<boolean>) {
    const keepGoing = await fn(this)
    if (!keepGoing) return
    const entries = await this.getEntries()
    for (const entry of entries) {
      if (entry.isTree()) {
        await entry.walk(fn)
      } else {
        await fn(entry)
      }
    }
  }

  // Walks tree & returns all nodes
  async allNodes() {
    const nodes: NodeEntry[] = []
    await this.walk((entry) => {
      nodes.push(entry)
      return true
    })
    return nodes
  }

  // Walks tree & returns all leaves
  async leaves() {
    const leaves: Leaf[] = []
    await this.walk((entry) => {
      if (entry.isLeaf()) leaves.push(entry)
      return true
    })
    return leaves
  }

  // Returns total leaf count
  async leafCount(): Promise<number> {
    const leaves = await this.leaves()
    return leaves.length
  }

  // Matching Leaf interface
  // -------------------

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

export class Leaf {
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

const layerForEntries = async (
  entries: NodeEntry[],
): Promise<number | null> => {
  const firstLeaf = entries.find((entry) => entry.isLeaf())
  if (!firstLeaf || firstLeaf.isTree()) return null
  return await leadingZerosOnHash(firstLeaf.key)
}

const entriesToData = (entries: NodeEntry[]): NodeData => {
  return entries.map((entry) => {
    if (entry.isLeaf()) {
      return [entry.key, entry.value]
    } else {
      return entry.pointer
    }
  })
}

const getCidForEntries = async (entries: NodeEntry[]): Promise<CID> => {
  const data = entriesToData(entries)
  const block = await Block.encode({
    value: data as any,
    codec: blockCodec,
    hasher: blockHasher,
  })
  return block.cid
}

export default MST
