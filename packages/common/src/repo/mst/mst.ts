import * as Block from 'multiformats/block'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import { CID } from 'multiformats'
import * as uint8arrays from 'uint8arrays'
import IpldStore from '../../blockstore/ipld-store'
import { sha256 } from '@adxp/crypto'

import z from 'zod'
import { schema } from '../../common/types'
import { DataDiff } from './diff'
import { DataStore } from '../types'
import { BlockWriter } from '@ipld/car/api'

/**
 * This is an implementation of a Merkle Search Tree (MST)
 * The data structure is described here: https://hal.inria.fr/hal-02303490/document
 * The MST is an ordered, insert-order-independent, deterministic tree.
 * Keys are laid out in alphabetic order.
 * The key insight of an MST is that each key is hashed and starting 0s are counted
 * to determine which layer it falls on (5 zeros for ~32 fanout).
 * This is a merkle tree, so each subtree is referred to by it's hash (CID).
 * When a leaf is changed, ever tree on the path to that leaf is changed as well,
 * thereby updating the root hash.
 */

/**
 * A couple notes on CBOR encoding:
 *
 * There are never two neighboring subtrees.
 * Therefore, we can represent a node as an array of
 * leaves & pointers to their right neighbor (possibly null),
 * along with a pointer to the left-most subtree (also possibly null).
 *
 * Most keys in a subtree will have overlap.
 * We do compression on prefixes by describing keys as:
 * - the length of the prefix that it shares in common with the preceding key
 * - the rest of the string
 *
 * For example:
 * If the first leaf in a tree is `bsky/posts/abcdefg` and the second is `bsky/posts/abcdehi`
 * Then the first will be described as `prefix: 0, key: 'bsky/posts/abcdefg'`,
 * and the second will be described as `prefix: 16, key: 'hi'.`
 */
const subTreePointer = z.nullable(schema.cid)
const treeEntry = z.object({
  p: z.number(), // prefix count of utf-8 chars that this key shares with the prev key
  k: z.string(), // the rest of the key outside the shared prefix
  v: schema.cid, // value
  t: subTreePointer, // next subtree (to the right of leaf)
})
export const nodeDataSchema = z.object({
  l: subTreePointer, // left-most subtree
  e: z.array(treeEntry), //entries
})
export type NodeData = z.infer<typeof nodeDataSchema>

export type NodeEntry = MST | Leaf

const DEFAULT_MST_FANOUT = 16
export type Fanout = 2 | 8 | 16 | 32 | 64
export type MstOpts = {
  layer: number
  fanout: Fanout
}

export class MST implements DataStore {
  blockstore: IpldStore
  fanout: Fanout
  entries: NodeEntry[] | null
  layer: number | null
  pointer: CID
  outdatedPointer = false

  constructor(
    blockstore: IpldStore,
    fanout: Fanout,
    pointer: CID,
    entries: NodeEntry[] | null,
    layer: number | null,
  ) {
    this.blockstore = blockstore
    this.fanout = fanout
    this.entries = entries
    this.layer = layer
    this.pointer = pointer
  }

  static async create(
    blockstore: IpldStore,
    entries: NodeEntry[] = [],
    opts?: Partial<MstOpts>,
  ): Promise<MST> {
    const pointer = await cidForEntries(entries)
    const { layer = 0, fanout = DEFAULT_MST_FANOUT } = opts || {}
    return new MST(blockstore, fanout, pointer, entries, layer)
  }

  static async fromData(
    blockstore: IpldStore,
    data: NodeData,
    opts?: Partial<MstOpts>,
  ): Promise<MST> {
    const { layer = null, fanout = DEFAULT_MST_FANOUT } = opts || {}
    const entries = await deserializeNodeData(blockstore, data, opts)
    const pointer = await cidForNodeData(data)
    return new MST(blockstore, fanout, pointer, entries, layer)
  }

  static load(blockstore: IpldStore, cid: CID, opts?: Partial<MstOpts>): MST {
    const { layer = null, fanout = DEFAULT_MST_FANOUT } = opts || {}
    return new MST(blockstore, fanout, cid, null, layer)
  }

  // Immutability
  // -------------------

  // We never mutate an MST, we just return a new MST with updated values
  async newTree(entries: NodeEntry[]): Promise<MST> {
    const mst = new MST(
      this.blockstore,
      this.fanout,
      this.pointer,
      entries,
      this.layer,
    )
    mst.outdatedPointer = true
    return mst
  }

  // Getters (lazy load)
  // -------------------

  // We don't want to load entries of every subtree, just the ones we need
  async getEntries(): Promise<NodeEntry[]> {
    if (this.entries) return [...this.entries]
    if (this.pointer) {
      const data = await this.blockstore.get(this.pointer, nodeDataSchema)
      const firstLeaf = data.e[0]
      const layer =
        firstLeaf !== undefined
          ? await leadingZerosOnHash(firstLeaf.k, this.fanout)
          : undefined
      this.entries = await deserializeNodeData(this.blockstore, data, {
        layer,
        fanout: this.fanout,
      })

      return this.entries
    }
    throw new Error('No entries or CID provided')
  }

  // We don't hash the node on every mutation for performance reasons
  // Instead we keep track of whether the pointer is outdated and only (recursively) calculate when needed
  async getPointer(): Promise<CID> {
    if (!this.outdatedPointer) return this.pointer
    let entries = await this.getEntries()
    const outdated = entries.filter(
      (e) => e.isTree() && e.outdatedPointer,
    ) as MST[]
    if (outdated.length > 0) {
      await Promise.all(outdated.map((e) => e.getPointer()))
      entries = await this.getEntries()
    }
    this.pointer = await cidForEntries(entries)
    this.outdatedPointer = false
    return this.pointer
  }

  // We should be able to find the layer of a node by either a hint on creation or by looking at the first leaf
  // If we have neither a hint nor a leaf, we throw an error
  // We could recurse to find the layer, but it isn't necessary for any of our current operations
  async getLayer(): Promise<number> {
    if (this.layer !== null) return this.layer
    const entries = await this.getEntries()
    this.layer = await layerForEntries(entries, this.fanout)
    if (!this.layer) this.layer = 0
    return this.layer
  }

  // Core functionality
  // -------------------

  // Persist the MST to the blockstore
  async save(): Promise<CID> {
    const pointer = await this.getPointer()
    const alreadyHas = await this.blockstore.has(pointer)
    if (alreadyHas) return pointer
    const entries = await this.getEntries()
    const data = serializeNodeData(entries)
    const put = await this.blockstore.put(data as any)
    for (const entry of entries) {
      if (entry.isTree()) {
        await entry.save()
      }
    }
    return pointer
  }

  // Adds a new leaf for the given key/value pair
  // Throws if a leaf with that key already exists
  async add(key: string, value: CID, knownZeros?: number): Promise<MST> {
    const keyZeros = knownZeros ?? (await leadingZerosOnHash(key, this.fanout))
    const layer = await this.getLayer()
    const newLeaf = new Leaf(key, value)
    if (keyZeros === layer) {
      // it belongs in this layer
      const index = await this.findGtOrEqualLeafIndex(key)
      const found = await this.atIndex(index)
      if (found?.isLeaf() && found.key === key) {
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
        const newSubtree = await prevNode.add(key, value, keyZeros)
        return this.updateEntry(index - 1, newSubtree)
      } else {
        const subTree = await this.createChild()
        const newSubTree = await subTree.add(key, value, keyZeros)
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
      const newRoot = await MST.create(this.blockstore, updated, {
        layer: keyZeros,
        fanout: this.fanout,
      })
      newRoot.outdatedPointer = true
      return newRoot
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
  async update(key: string, value: CID): Promise<MST> {
    const index = await this.findGtOrEqualLeafIndex(key)
    const found = await this.atIndex(index)
    if (found && found.isLeaf() && found.key === key) {
      return this.updateEntry(index, new Leaf(key, value))
    }
    const prev = await this.atIndex(index - 1)
    if (prev && prev.isTree()) {
      const updatedTree = await prev.update(key, value)
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
      const subTreeEntries = await subtree.getEntries()
      if (subTreeEntries.length === 0) {
        return this.removeEntry(index - 1)
      } else {
        return this.updateEntry(index - 1, subtree)
      }
    } else {
      throw new Error(`Could not find a record with key: ${key}`)
    }
  }

  // Walk two MSTs to find the semantic changes
  async diff(other: MST): Promise<DataDiff> {
    await this.getPointer()
    await other.getPointer()
    const diff = new DataDiff()

    const leftWalker = new Walker(this)
    const rightWalker = new Walker(other)
    while (!leftWalker.status.done || !rightWalker.status.done) {
      if (leftWalker.status.done && !rightWalker.status.done) {
        diff.recordAdd(rightWalker.status.curr)
        await rightWalker.advance()
        continue
      } else if (!leftWalker.status.done && rightWalker.status.done) {
        diff.recordDelete(leftWalker.status.curr)
        await leftWalker.advance()
        continue
      }

      const left = leftWalker.status.curr
      const right = rightWalker.status.curr
      if (left === null || right === null) break

      if (left.isLeaf() && right.isLeaf()) {
        if (left.key === right.key) {
          if (!left.value.equals(right.value)) {
            diff.recordUpdate(left.key, left.value, right.value)
          }
          await leftWalker.stepOver()
          await rightWalker.stepOver()
        } else if (left.key < right.key) {
          diff.recordDelete(left)
          await leftWalker.stepOver()
        } else {
          diff.recordAdd(right)
          await rightWalker.stepOver()
        }
        continue
      }

      if (leftWalker.layer() > rightWalker.layer()) {
        if (left.isLeaf()) {
          if (right.isLeaf()) {
            diff.recordAdd(right)
          } else {
            diff.recordAddedCid(right.pointer)
          }
          await rightWalker.advance()
        } else {
          await leftWalker.stepInto()
        }
        continue
      } else if (leftWalker.layer() < rightWalker.layer()) {
        if (right.isLeaf()) {
          if (left.isLeaf()) {
            diff.recordDelete(left)
          }
          await leftWalker.advance()
        } else {
          diff.recordAddedCid(right.pointer)
          await rightWalker.stepInto()
        }
        continue
      }

      if (left.isTree() && right.isTree()) {
        if (left.pointer.equals(right.pointer)) {
          await leftWalker.stepOver()
          await rightWalker.stepOver()
        } else {
          diff.recordAddedCid(right.pointer)
          await leftWalker.stepInto()
          await rightWalker.stepInto()
        }
        continue
      }

      if (left.isLeaf() && right.isTree()) {
        await diff.recordAddedCid(right.pointer)
        await rightWalker.stepInto()
        continue
      }

      if (left.isTree() && right.isLeaf()) {
        await leftWalker.stepInto()
        continue
      }

      throw new Error('Unidentifiable case in diff walk')
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
    return MST.create(this.blockstore, [], {
      layer: layer - 1,
      fanout: this.fanout,
    })
  }

  async createParent(): Promise<MST> {
    const layer = await this.getLayer()
    return MST.create(this.blockstore, [this], {
      layer: layer + 1,
      fanout: this.fanout,
    })
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

  // List operations (partial tree traversal)
  // -------------------

  // @TODO write tests for these

  // Walk tree starting at key
  async *walkLeavesFrom(key: string): AsyncIterable<Leaf> {
    const index = await this.findGtOrEqualLeafIndex(key)
    const entries = await this.getEntries()
    const prev = entries[index - 1]
    if (prev && prev.isTree()) {
      for await (const e of prev.walkLeavesFrom(key)) {
        yield e
      }
    }
    for (let i = index; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.isLeaf()) {
        yield entry
      } else {
        for await (const e of entry.walkLeavesFrom(key)) {
          yield e
        }
      }
    }
  }

  async list(from: string, count: number): Promise<Leaf[]> {
    const vals: Leaf[] = []
    for await (const leaf of this.walkLeavesFrom(from)) {
      if (vals.length >= count) break
      vals.push(leaf)
    }
    return vals
  }

  async listWithPrefix(
    prefix: string,
    count = Number.MAX_SAFE_INTEGER,
  ): Promise<Leaf[]> {
    const vals: Leaf[] = []
    for await (const leaf of this.walkLeavesFrom(prefix)) {
      if (vals.length >= count || !leaf.key.startsWith(prefix)) break
      vals.push(leaf)
    }
    return vals
  }

  // Full tree traversal
  // -------------------

  // Walk full tree & emit nodes, consumer can bail at any point by returning false
  async *walk(): AsyncIterable<NodeEntry> {
    yield this
    const entries = await this.getEntries()
    for (const entry of entries) {
      if (entry.isTree()) {
        for await (const e of entry.walk()) {
          yield e
        }
      } else {
        yield entry
      }
    }
  }

  // Walk full tree & emit nodes, consumer can bail at any point by returning false
  async paths(): Promise<NodeEntry[][]> {
    const entries = await this.getEntries()
    let paths: NodeEntry[][] = []
    for (const entry of entries) {
      if (entry.isLeaf()) {
        paths.push([entry])
      }
      if (entry.isTree()) {
        const subPaths = await entry.paths()
        paths = [...paths, ...subPaths.map((p) => [entry, ...p])]
      }
    }
    return paths
  }

  // Walks tree & returns all nodes
  async allNodes(): Promise<NodeEntry[]> {
    const nodes: NodeEntry[] = []
    for await (const entry of this.walk()) {
      nodes.push(entry)
    }
    return nodes
  }

  // Walks tree & returns all leaves
  async leaves() {
    const leaves: Leaf[] = []
    for await (const entry of this.walk()) {
      if (entry.isLeaf()) leaves.push(entry)
    }
    return leaves
  }

  // Returns total leaf count
  async leafCount(): Promise<number> {
    const leaves = await this.leaves()
    return leaves.length
  }

  // Sync Protocol

  async writeToCarStream(car: BlockWriter): Promise<void> {
    for await (const entry of this.walk()) {
      if (entry.isTree()) {
        const pointer = await entry.getPointer()
        await this.blockstore.addToCar(car, pointer)
      } else {
        await this.blockstore.addToCar(car, entry.value)
      }
    }
  }

  // Matching Leaf interface
  // -------------------

  isTree(): this is MST {
    return true
  }

  isLeaf(): this is Leaf {
    return false
  }

  async equals(other: NodeEntry): Promise<boolean> {
    if (other.isLeaf()) return false
    const thisPointer = await this.getPointer()
    const otherPointer = await other.getPointer()
    return thisPointer.equals(otherPointer)
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

type SupportedBases = 'base2' | 'base8' | 'base16' | 'base32' | 'base64'

export const leadingZerosOnHash = async (
  key: string,
  fanout: Fanout,
): Promise<number> => {
  if ([2, 8, 16, 32, 64].indexOf(fanout) < 0) {
    throw new Error(`Not a valid fanout: ${fanout}`)
  }
  const base: SupportedBases = `base${fanout}`
  const zeroChar = uint8arrays.toString(new Uint8Array(1), base)[0]
  const hash = await sha256(key)
  const encoded = uint8arrays.toString(hash, base)
  let count = 0
  for (const char of encoded) {
    if (char === zeroChar) {
      count++
    } else {
      break
    }
  }
  return count
}

const layerForEntries = async (
  entries: NodeEntry[],
  fanout: Fanout,
): Promise<number | null> => {
  const firstLeaf = entries.find((entry) => entry.isLeaf())
  if (!firstLeaf || firstLeaf.isTree()) return null
  return await leadingZerosOnHash(firstLeaf.key, fanout)
}

const deserializeNodeData = async (
  blockstore: IpldStore,
  data: NodeData,
  opts?: Partial<MstOpts>,
): Promise<NodeEntry[]> => {
  const { layer, fanout } = opts || {}
  const entries: NodeEntry[] = []
  if (data.l !== null) {
    entries.push(
      await MST.load(blockstore, data.l, {
        layer: layer ? layer - 1 : undefined,
        fanout,
      }),
    )
  }
  let lastKey = ''
  for (const entry of data.e) {
    const key = lastKey.slice(0, entry.p) + entry.k
    entries.push(new Leaf(key, entry.v))
    lastKey = key
    if (entry.t !== null) {
      entries.push(
        await MST.load(blockstore, entry.t, {
          layer: layer ? layer - 1 : undefined,
          fanout,
        }),
      )
    }
  }
  return entries
}

const serializeNodeData = (entries: NodeEntry[]): NodeData => {
  const data: NodeData = {
    l: null,
    e: [],
  }
  let i = 0
  if (entries[0]?.isTree()) {
    i++
    data.l = entries[0].pointer
  }
  let lastKey = ''
  while (i < entries.length) {
    const leaf = entries[i]
    const next = entries[i + 1]
    if (!leaf.isLeaf()) {
      throw new Error('Not a valid node: two subtrees next to each other')
    }
    i++
    let subtree: CID | null = null
    if (next?.isTree()) {
      subtree = next.pointer
      i++
    }
    const prefixLen = countPrefixLen(lastKey, leaf.key)
    data.e.push({
      p: prefixLen,
      k: leaf.key.slice(prefixLen),
      v: leaf.value,
      t: subtree,
    })

    lastKey = leaf.key
  }
  return data
}

export const countPrefixLen = (a: string, b: string): number => {
  let i
  for (i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      break
    }
  }
  return i
}

const cidForNodeData = async (data: NodeData): Promise<CID> => {
  const block = await Block.encode({
    value: data as any,
    codec: blockCodec,
    hasher: blockHasher,
  })
  return block.cid
}

const cidForEntries = async (entries: NodeEntry[]): Promise<CID> => {
  const data = serializeNodeData(entries)
  return cidForNodeData(data)
}

type Status =
  | {
      done: true
      curr: null
      walking: null
      index: number
    }
  | {
      done: false
      curr: NodeEntry
      walking: MST | null
      index: number
    }

class Walker {
  stack: Status[] = []
  status: Status

  constructor(public root: MST) {
    this.status = {
      done: false,
      curr: root,
      walking: null,
      index: 0,
    }
  }

  layer(): number {
    if (this.status.done) {
      throw new Error('Walk is done')
    }
    if (this.status.walking) {
      return this.status.walking.layer ?? 0
    }
    if (this.status.curr.isTree()) {
      return (this.status.curr.layer ?? 0) + 1
    }
    throw new Error('Could not identify layer of walk')
  }

  async stepOver(): Promise<void> {
    if (this.status.done) return
    // if stepping over the root of the node, we're done
    if (this.status.walking === null) {
      this.status = {
        done: true,
        curr: null,
        walking: null,
        index: 0,
      }
      return
    }
    const entries = await this.status.walking.getEntries()
    this.status.index++
    const next = entries[this.status.index]
    if (!next) {
      const popped = this.stack.pop()
      if (!popped) {
        this.status = {
          done: true,
          curr: null,
          walking: null,
          index: 0,
        }
        return
      } else {
        this.status = popped
        await this.stepOver()
        return
      }
    } else {
      this.status.curr = next
    }
  }

  async stepInto(): Promise<void> {
    if (this.status.done) return
    // edge case for very start of walk
    if (this.status.walking === null) {
      if (!this.status.curr.isTree()) {
        throw new Error('aosdiur')
      }
      const next = await this.status.curr.atIndex(0)
      if (!next) {
        throw new Error('aosdiur')
      }
      this.status = {
        done: false,
        walking: this.status.curr,
        curr: next,
        index: 0,
      }
      return
    }
    if (!this.status.curr.isTree()) {
      throw new Error('No tree at pointer, cannot step into')
    }

    const next = await this.status.curr.atIndex(0)
    if (!next) {
      throw new Error(
        'Tried to step into a node with 0 entries which is invalid',
      )
    }

    this.stack.push({ ...this.status })
    this.status.walking = this.status.curr
    this.status.curr = next
    this.status.index = 0
  }

  async advance(): Promise<void> {
    if (this.status.done) return
    if (this.status.curr.isLeaf()) {
      await this.stepOver()
    } else {
      await this.stepInto()
    }
  }

  async walkUntil(key: string): Promise<NodeEntry[]> {
    const nodes: NodeEntry[] = []
    while (!this.status.done) {
      if (this.status.curr.isLeaf() && this.status.curr.key > key) {
        break
      }
      nodes.push(this.status.curr)
      await this.advance()
      if (this.status.curr.isLeaf() && this.status.curr.key === key) {
        break
      }
    }
    return nodes
  }

  async curr(): Promise<NodeEntry> {
    if (this.status.done) {
      throw new Error('Walk finished, no more nodes')
    }
    return this.status.curr
  }
}

export default MST
