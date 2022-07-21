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
  // const spliceIndex = Math.max(index, 0)
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

  static async load(blockstore: IpldStore, cid: CID): Promise<MST> {
    const node = await blockstore.get(cid, nodeSchema)

    return new MST(blockstore, cid, node, 0) // @TODO calculate 0s
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
        const subTree = await MST.load(this.blockstore, prevNode)
        const splitSubTree = await subTree.splitAround(key)
        const newNode = this.node.slice(0, index - 1)
        if (splitSubTree[0]) newNode.push(splitSubTree[0])
        newNode.push(value)
        if (splitSubTree[1]) newNode.push(splitSubTree[1])
        newNode.push(...this.node.slice(index))
        this.node = newNode
        return this.put()
      }
    } else {
      // it belongs in a different layer
    }
  }

  insertIndex(key: string): number {
    // find first leaf that is bigger
    const maybeIndex = this.node.findIndex(
      (entry) => check.is(entry, leafPointer) && entry[0] > key,
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
    return [left.cid, right.cid]
  }

  // async lowest(): Promise<string> {
  //   const lowestEntry = this.node[0]
  //   if (check.is(lowestEntry, leafPointer)) {
  //     return lowestEntry[0]
  //   } else {
  //     const subTree = await MST.load(this.blockstore, lowestEntry)
  //     return subTree.lowest()
  //   }
  // }

  // async highest(): Promise<string> {
  //   const highestEntry = this.node[this.node.length]
  //   if (check.is(highestEntry, leafPointer)) {
  //     return highestEntry[0]
  //   } else {
  //     const subTree = await MST.load(this.blockstore, highestEntry)
  //     return subTree.lowest()
  //   }
  // }

  // async get(key: string): Promise<CID> {}
  // async delete(key: string): Promise<void> {}
}

export default MST
