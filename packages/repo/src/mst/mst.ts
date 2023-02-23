import z from 'zod'
import { CID } from 'multiformats'

import { ReadableBlockstore } from '../storage'
import { schema as common, cidForCbor } from '@atproto/common'
import { DataStore } from '../types'
import { BlockWriter } from '@ipld/car/api'
import * as util from './util'
import BlockMap from '../block-map'
import CidSet from '../cid-set'
import { MissingBlockError, MissingBlocksError } from '../error'
import * as parse from '../parse'

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
 *
 * For atproto, we use SHA-256 as the key hashing algorithm, and ~16 fanout
 * (4-bits of zero per layer).
 *
 * NOTE: currently keys are strings, not bytes. Because UTF-8 strings can't be
 * safely split at arbitrary byte boundaries (the results are not necessarily
 * valid UTF-8 strings), this means that "wide" characters not really supported
 * in keys, particularly across programming language implementations. We
 * recommend sticking with simple alphanumeric (ASCII) strings.
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
const subTreePointer = z.nullable(common.cid)
const treeEntry = z.object({
  p: z.number(), // prefix count of utf-8 chars that this key shares with the prev key
  k: z.string(), // the rest of the key outside the shared prefix
  v: common.cid, // value
  t: subTreePointer, // next subtree (to the right of leaf)
})
const nodeData = z.object({
  l: subTreePointer, // left-most subtree
  e: z.array(treeEntry), //entries
})
export type NodeData = z.infer<typeof nodeData>

export const nodeDataDef = {
  name: 'mst node',
  schema: nodeData,
}

export type NodeEntry = MST | Leaf

const DEFAULT_MST_FANOUT = 16
export type Fanout = 2 | 8 | 16 | 32 | 64
export type MstOpts = {
  layer: number
  fanout: Fanout
}

export class MST implements DataStore {
  storage: ReadableBlockstore
  fanout: Fanout
  entries: NodeEntry[] | null
  layer: number | null
  pointer: CID
  outdatedPointer = false

  constructor(
    storage: ReadableBlockstore,
    fanout: Fanout,
    pointer: CID,
    entries: NodeEntry[] | null,
    layer: number | null,
  ) {
    this.storage = storage
    this.fanout = fanout
    this.entries = entries
    this.layer = layer
    this.pointer = pointer
  }

  static async create(
    storage: ReadableBlockstore,
    entries: NodeEntry[] = [],
    opts?: Partial<MstOpts>,
  ): Promise<MST> {
    const pointer = await util.cidForEntries(entries)
    const { layer = null, fanout = DEFAULT_MST_FANOUT } = opts || {}
    return new MST(storage, fanout, pointer, entries, layer)
  }

  static async fromData(
    storage: ReadableBlockstore,
    data: NodeData,
    opts?: Partial<MstOpts>,
  ): Promise<MST> {
    const { layer = null, fanout = DEFAULT_MST_FANOUT } = opts || {}
    const entries = await util.deserializeNodeData(storage, data, opts)
    const pointer = await cidForCbor(data)
    return new MST(storage, fanout, pointer, entries, layer)
  }

  // this is really a *lazy* load, doesn't actually touch storage
  static load(
    storage: ReadableBlockstore,
    cid: CID,
    opts?: Partial<MstOpts>,
  ): MST {
    const { layer = null, fanout = DEFAULT_MST_FANOUT } = opts || {}
    return new MST(storage, fanout, cid, null, layer)
  }

  // Immutability
  // -------------------

  // We never mutate an MST, we just return a new MST with updated values
  async newTree(entries: NodeEntry[]): Promise<MST> {
    const mst = new MST(
      this.storage,
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
      const data = await this.storage.readObj(this.pointer, nodeDataDef)
      const firstLeaf = data.e[0]
      const layer =
        firstLeaf !== undefined
          ? await util.leadingZerosOnHash(firstLeaf.k, this.fanout)
          : undefined
      this.entries = await util.deserializeNodeData(this.storage, data, {
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
    this.pointer = await util.cidForEntries(entries)
    this.outdatedPointer = false
    return this.pointer
  }

  // In most cases, we get the layer of a node from a hint on creation
  // In the case of the topmost node in the tree, we look for a key in the node & determine the layer
  // In the case where we don't find one, we recurse down until we do.
  // If we still can't find one, then we have an empty tree and the node is layer 0
  async getLayer(): Promise<number> {
    this.layer = await this.attemptGetLayer()
    if (this.layer === null) this.layer = 0
    return this.layer
  }

  async attemptGetLayer(): Promise<number | null> {
    if (this.layer !== null) return this.layer
    const entries = await this.getEntries()
    let layer = await util.layerForEntries(entries, this.fanout)
    if (layer === null) {
      for (const entry of entries) {
        if (entry.isTree()) {
          const childLayer = await entry.attemptGetLayer()
          if (childLayer !== null) {
            layer = childLayer + 1
            break
          }
        }
      }
    }
    if (layer !== null) this.layer = layer
    return layer
  }

  // Core functionality
  // -------------------

  // Return the necessary blocks to persist the MST to repo storage
  async getUnstoredBlocks(): Promise<{ root: CID; blocks: BlockMap }> {
    const blocks = new BlockMap()
    const pointer = await this.getPointer()
    const alreadyHas = await this.storage.has(pointer)
    if (alreadyHas) return { root: pointer, blocks }
    const entries = await this.getEntries()
    const data = util.serializeNodeData(entries)
    await blocks.add(data)
    for (const entry of entries) {
      if (entry.isTree()) {
        const subtree = await entry.getUnstoredBlocks()
        blocks.addMap(subtree.blocks)
      }
    }
    return { root: pointer, blocks: blocks }
  }

  // Adds a new leaf for the given key/value pair
  // Throws if a leaf with that key already exists
  async add(key: string, value: CID, knownZeros?: number): Promise<MST> {
    const keyZeros =
      knownZeros ?? (await util.leadingZerosOnHash(key, this.fanout))
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
      const split = await this.splitAround(key)
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
      const newRoot = await MST.create(this.storage, updated, {
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
    const altered = await this.deleteRecurse(key)
    return altered.trimTop()
  }

  async deleteRecurse(key: string): Promise<MST> {
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
      const subtree = await prev.deleteRecurse(key)
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

  // if the topmost node in the tree only points to another tree, trim the top and return the subtree
  async trimTop(): Promise<MST> {
    const entries = await this.getEntries()
    if (entries.length === 1 && entries[0].isTree()) {
      return entries[0].trimTop()
    } else {
      return this
    }
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
    return MST.create(this.storage, [], {
      layer: layer - 1,
      fanout: this.fanout,
    })
  }

  async createParent(): Promise<MST> {
    const layer = await this.getLayer()
    const parent = await MST.create(this.storage, [this], {
      layer: layer + 1,
      fanout: this.fanout,
    })
    parent.outdatedPointer = true
    return parent
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

  async list(
    count = Number.MAX_SAFE_INTEGER,
    after?: string,
    before?: string,
  ): Promise<Leaf[]> {
    const vals: Leaf[] = []
    for await (const leaf of this.walkLeavesFrom(after || '')) {
      if (leaf.key === after) continue
      if (vals.length >= count) break
      if (before && leaf.key >= before) break
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

  // Walks tree & returns all cids
  async allCids(): Promise<CidSet> {
    const cids = new CidSet()
    const entries = await this.getEntries()
    for (const entry of entries) {
      if (entry.isLeaf()) {
        cids.add(entry.value)
      } else {
        const subtreeCids = await entry.allCids()
        cids.addSet(subtreeCids)
      }
    }
    cids.add(await this.getPointer())
    return cids
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

  // Reachable tree traversal
  // -------------------

  // Walk reachable branches of tree & emit nodes, consumer can bail at any point by returning false
  async *walkReachable(): AsyncIterable<NodeEntry> {
    yield this
    const entries = await this.getEntries()
    for (const entry of entries) {
      if (entry.isTree()) {
        try {
          for await (const e of entry.walk()) {
            yield e
          }
        } catch (err) {
          if (err instanceof MissingBlockError) {
            continue
          } else {
            throw err
          }
        }
      } else {
        yield entry
      }
    }
  }

  async reachableLeaves(): Promise<Leaf[]> {
    const leaves: Leaf[] = []
    for await (const entry of this.walkReachable()) {
      if (entry.isLeaf()) leaves.push(entry)
    }
    return leaves
  }

  // Sync Protocol

  async writeToCarStream(car: BlockWriter): Promise<void> {
    const entries = await this.getEntries()
    const leaves = new CidSet()
    let toFetch = new CidSet()
    toFetch.add(await this.getPointer())
    for (const entry of entries) {
      if (entry.isLeaf()) {
        leaves.add(entry.value)
      } else {
        toFetch.add(await entry.getPointer())
      }
    }
    while (toFetch.size() > 0) {
      const nextLayer = new CidSet()
      const fetched = await this.storage.getBlocks(toFetch.toList())
      if (fetched.missing.length > 0) {
        throw new MissingBlocksError('mst node', fetched.missing)
      }
      for (const cid of toFetch.toList()) {
        const found = await parse.getAndParse(fetched.blocks, cid, nodeDataDef)
        await car.put({ cid, bytes: found.bytes })
        const entries = await util.deserializeNodeData(this.storage, found.obj)

        for (const entry of entries) {
          if (entry.isLeaf()) {
            leaves.add(entry.value)
          } else {
            nextLayer.add(await entry.getPointer())
          }
        }
      }
      toFetch = nextLayer
    }
    const leafData = await this.storage.getBlocks(leaves.toList())
    if (leafData.missing.length > 0) {
      throw new MissingBlocksError('mst leaf', leafData.missing)
    }

    for (const leaf of leafData.blocks.entries()) {
      await car.put(leaf)
    }
  }

  async cidsForPath(key: string): Promise<CID[]> {
    const cids: CID[] = [await this.getPointer()]
    const index = await this.findGtOrEqualLeafIndex(key)
    const found = await this.atIndex(index)
    if (found && found.isLeaf() && found.key === key) {
      return [...cids, found.value]
    }
    const prev = await this.atIndex(index - 1)
    if (prev && prev.isTree()) {
      return [...cids, ...(await prev.cidsForPath(key))]
    }
    return cids
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

export default MST
