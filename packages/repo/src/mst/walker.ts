import { MST, NodeEntry } from './mst'

type WalkerStatusDone = {
  done: true
}

type WalkerStatusProgress = {
  done: false
  curr: NodeEntry
  walking: MST | null // walking set to null if `curr` is the root of the tree
  index: number
  layer: number // layer of `curr`
}

type WalkerStatus = WalkerStatusDone | WalkerStatusProgress

export const rightmostLeaf = async (node: MST): Promise<string | null> => {
  const entries = await node.getEntries()
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry.isLeaf()) return entry.key
    if (entry.isTree()) return rightmostLeaf(entry)
  }
  return null
}

export class MstWalker {
  stack: WalkerStatus[] = []
  status: WalkerStatus
  lastLeafKey: string = ''

  constructor(
    public root: MST,
    rootLayer: number,
  ) {
    this.status = {
      done: false,
      curr: root,
      walking: null,
      index: 0,
      layer: rootLayer,
    }
  }

  // return the layer of the current node
  layer(): number {
    if (this.status.done) {
      throw new Error('Walk is done')
    }
    return this.status.layer
  }

  // move to the next node in the subtree, skipping over the subtree
  async stepOver(): Promise<void> {
    if (this.status.done) return
    // if stepping over the root of the node, we're done
    if (this.status.walking === null) {
      this.status = { done: true }
      return
    }
    const entries = await this.status.walking.getEntries()
    this.status.index++
    const next = entries[this.status.index]
    if (!next) {
      const popped = this.stack.pop()
      if (!popped) {
        this.status = { done: true }
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

  // step into a subtree, throws if currently pointed at a leaf
  async stepInto(): Promise<void> {
    if (this.status.done) return
    // edge case for very start of walk
    if (this.status.walking === null) {
      if (!this.status.curr.isTree()) {
        throw new Error('The root of the tree cannot be a leaf')
      }
      const next = await this.status.curr.atIndex(0)
      if (!next) {
        this.status = { done: true }
      } else {
        this.status = {
          done: false,
          walking: this.status.curr,
          curr: next,
          index: 0,
          layer: this.status.layer - 1,
        }
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
    const childLayer = this.status.layer - 1
    this.status.walking = this.status.curr
    this.status.curr = next
    this.status.index = 0
    this.status.layer = childLayer
  }

  // advance the pointer to the next node in the tree,
  // stepping into the current node if necessary
  async advance(): Promise<void> {
    if (this.status.done) return
    if (this.status.curr.isLeaf()) {
      this.lastLeafKey = this.status.curr.key
      await this.stepOver()
    } else {
      await this.stepInto()
    }
  }
}
