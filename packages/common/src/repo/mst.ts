import { CID } from 'multiformats'
import * as uint8arrays from 'uint8arrays'
import IpldStore from '../blockstore/ipld-store'
import { sha256 } from '@adxp/crypto'

import * as dagCbor from '@ipld/dag-cbor'
import z from 'zod'
import { schema } from '../common/types'
import * as check from '../common/check'

const leafPointer = z.tuple([z.string(), schema.cid])
const treePointer = schema.cid
const treeEntry = z.union([leafPointer, treePointer])
const nodeSchema = z.array(treeEntry)

type LeafPointer = z.infer<typeof leafPointer>
type TreePointer = z.infer<typeof treePointer>
type TreeEntry = z.infer<typeof treeEntry>
type Node = z.infer<typeof nodeSchema>

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

const spliceIn = <T>(array: T[], item: T, index: number): T[] => {
  return [...array.slice(0, index), item, ...array.slice(index)]
}

export class MST {
  blockstore: IpldStore
  cid: CID
  node: Node
  zeros: number

  constructor(blockstore: IpldStore, cid: CID, node: Node, zeros: number) {
    this.blockstore = blockstore
    this.cid = cid
    this.node = node
    this.zeros = zeros
  }

  static async create(blockstore: IpldStore, zeros = 0): Promise<MST> {
    return MST.fromData(blockstore, [], zeros)
  }

  static async fromData(
    blockstore: IpldStore,
    node: Node,
    zeros: number,
  ): Promise<MST> {
    const cid = await blockstore.put(node as any)
    return new MST(blockstore, cid, node, zeros)
  }

  static async load(
    blockstore: IpldStore,
    cid: CID,
    zeros?: number,
  ): Promise<MST> {
    const node = await blockstore.get(cid, nodeSchema)
    if (!zeros) {
      const firstLeaf = node.find((entry) => check.is(entry, leafPointer))
      if (!firstLeaf) {
        throw new Error('not a valid mst node: no leaves')
      }
      zeros = await leadingZerosOnHash(firstLeaf[0])
    }
    return new MST(blockstore, cid, node, zeros)
  }

  async put(): Promise<CID> {
    this.cid = await this.blockstore.put(this.node as any) // @TODO no any
    return this.cid
  }

  async set(key: string, value: CID): Promise<CID> {
    const keyZeros = await leadingZerosOnHash(key)
    // it belongs in this layer
    if (keyZeros === this.zeros) {
      const index = this.insertIndex(key)
      const prevNode = this.node[index - 1]
      if (!prevNode || check.is(prevNode, leafPointer)) {
        // if entry before is a leaf, (or we're on far left) we can just splice in
        this.node = spliceIn(this.node, [key, value], index)
        return this.put()
      } else {
        // else we need to investigate the subtree
        const subTree = await MST.load(
          this.blockstore,
          prevNode,
          this.zeros - 1,
        )
        // we try to split the subtree around the key
        const splitSubTree = await subTree.splitAround(key)
        const newNode = this.node.slice(0, index - 1)
        if (splitSubTree[0]) newNode.push(splitSubTree[0])
        newNode.push([key, value])
        if (splitSubTree[1]) newNode.push(splitSubTree[1])
        newNode.push(...this.node.slice(index))
        this.node = newNode
        return this.put()
      }
    } else if (keyZeros < this.zeros) {
      // it belongs on a lower layer
      const index = this.insertIndex(key)
      const prevNode = this.node[index - 1]
      if (check.is(prevNode, treePointer)) {
        // if entry before is a tree, we add it to that tree
        const subTree = await MST.load(
          this.blockstore,
          prevNode,
          this.zeros - 1,
        )
        const newSubTreeCid = await subTree.set(key, value)
        this.node[index - 1] = newSubTreeCid
        return this.put()
      } else {
        // else we need to create the subtree for it to go in
        const subTree = await MST.create(this.blockstore, this.zeros - 1)
        const newSubTreeCid = await subTree.set(key, value)
        this.node = spliceIn(this.node, newSubTreeCid, index)
        return this.put()
      }
    } else {
      // it belongs on a higher layer & we must push the rest of the tree down
      // @TODO handle two level pushes
      const split = await this.splitAround(key)
      const newNode: Node = []
      if (split[0]) newNode.push(split[0])
      newNode.push([key, value])
      if (split[1]) newNode.push(split[1])
      this.node = newNode
      this.zeros++
      return this.put()
    }
  }

  // finds first leaf node that is greater than or equal to the value
  insertIndex(key: string): number {
    // find first leaf that is bigger
    const maybeIndex = this.node.findIndex(
      (entry) => check.is(entry, leafPointer) && entry[0] >= key,
    )
    // if not find, we're on the end
    return maybeIndex >= 0 ? maybeIndex : this.node.length
  }

  async splitAround(key: string): Promise<[CID | null, CID | null]> {
    const index = this.insertIndex(key)
    const leftData = this.node.slice(0, index)
    const rightData = this.node.slice(index)
    if (leftData.length === 0) {
      return [null, this.cid]
    }
    if (rightData.length === 0) {
      return [this.cid, null]
    }
    const left = await MST.fromData(this.blockstore, leftData, this.zeros)
    const right = await MST.fromData(this.blockstore, rightData, this.zeros)
    const prev = leftData[leftData.length - 1]
    if (check.is(prev, treePointer)) {
      const prevSubtree = await MST.load(this.blockstore, prev, this.zeros - 1)
      const prevSplit = await prevSubtree.splitAround(key)
      if (prevSplit[0]) {
        await left.append(prev)
      }
      if (prevSplit[1]) {
        await right.prepend(prev)
      }
    }

    return [left.cid, right.cid]
  }

  async append(entry: TreeEntry): Promise<CID> {
    this.node = [...this.node, entry]
    return this.put()
  }

  async prepend(entry: TreeEntry): Promise<CID> {
    this.node = [entry, ...this.node]
    return this.put()
  }

  async get(key: string): Promise<CID | null> {
    const index = this.insertIndex(key)
    const found = this.node[index]
    if (found && check.is(found, leafPointer) && found[0] === key) {
      return found[1]
    }
    const prev = this.node[index - 1]
    if (check.is(prev, treePointer)) {
      const subTree = await MST.load(this.blockstore, prev, this.zeros - 1)
      return subTree.get(key)
    }
    return null
  }

  async walk(fn: (level: number, key: string) => void) {
    for (const entry of this.node) {
      if (check.is(entry, treePointer)) {
        const subTree = await MST.load(this.blockstore, entry, this.zeros - 1)
        await subTree.walk(fn)
      } else {
        fn(this.zeros, entry[0])
      }
    }
  }

  // async delete(key: string): Promise<void> {}
}

export default MST
