import { DataDiff } from '../data-diff'
import MST from './mst'
import MstWalker from './walker'

export const nullDiff = async (tree: MST): Promise<DataDiff> => {
  const diff = new DataDiff()
  for await (const entry of tree.walk()) {
    if (entry.isLeaf()) {
      diff.recordAdd(entry.key, entry.value)
    } else {
      diff.recordNewCid(entry.pointer)
    }
  }
  return diff
}

export const mstDiff = async (
  curr: MST,
  prev: MST | null,
): Promise<DataDiff> => {
  await curr.getPointer()
  if (prev === null) {
    return nullDiff(curr)
  }

  await prev.getPointer()
  const diff = new DataDiff()

  const leftWalker = new MstWalker(prev)
  const rightWalker = new MstWalker(curr)
  while (!leftWalker.status.done || !rightWalker.status.done) {
    // if one walker is finished, continue walking the other & logging all nodes
    if (leftWalker.status.done && !rightWalker.status.done) {
      const node = rightWalker.status.curr
      if (node.isLeaf()) {
        diff.recordAdd(node.key, node.value)
      } else {
        diff.recordNewCid(node.pointer)
      }
      await rightWalker.advance()
      continue
    } else if (!leftWalker.status.done && rightWalker.status.done) {
      const node = leftWalker.status.curr
      if (node.isLeaf()) {
        diff.recordDelete(node.key, node.value)
      } else {
        diff.recordRemovedCid(node.pointer)
      }
      await leftWalker.advance()
      continue
    }
    if (leftWalker.status.done || rightWalker.status.done) break
    const left = leftWalker.status.curr
    const right = rightWalker.status.curr
    if (left === null || right === null) break

    // if both pointers are leaves, record an update & advance both or record the lowest key and advance that pointer
    if (left.isLeaf() && right.isLeaf()) {
      if (left.key === right.key) {
        if (!left.value.equals(right.value)) {
          diff.recordUpdate(left.key, left.value, right.value)
        }
        await leftWalker.advance()
        await rightWalker.advance()
      } else if (left.key < right.key) {
        diff.recordDelete(left.key, left.value)
        await leftWalker.advance()
      } else {
        diff.recordAdd(right.key, right.value)
        await rightWalker.advance()
      }
      continue
    }

    // next, ensure that we're on the same layer
    // if one walker is at a higher layer than the other, we need to do one of two things
    // if the higher walker is pointed at a tree, step into that tree to try to catch up with the lower
    // if the higher walker is pointed at a leaf, then advance the lower walker to try to catch up the higher
    if (leftWalker.layer() > rightWalker.layer()) {
      if (left.isLeaf()) {
        if (right.isLeaf()) {
          diff.recordAdd(right.key, right.value)
        } else {
          diff.recordNewCid(right.pointer)
        }
        await rightWalker.advance()
      } else {
        diff.recordRemovedCid(left.pointer)
        await leftWalker.stepInto()
      }
      continue
    } else if (leftWalker.layer() < rightWalker.layer()) {
      if (right.isLeaf()) {
        if (left.isLeaf()) {
          diff.recordDelete(left.key, left.value)
        } else {
          diff.recordRemovedCid(left.pointer)
        }
        await leftWalker.advance()
      } else {
        diff.recordNewCid(right.pointer)
        await rightWalker.stepInto()
      }
      continue
    }

    // if we're on the same level, and both pointers are trees, do a comparison
    // if they're the same, step over. if they're different, step in to find the subdiff
    if (left.isTree() && right.isTree()) {
      if (left.pointer.equals(right.pointer)) {
        await leftWalker.stepOver()
        await rightWalker.stepOver()
      } else {
        diff.recordNewCid(right.pointer)
        diff.recordRemovedCid(left.pointer)
        await leftWalker.stepInto()
        await rightWalker.stepInto()
      }
      continue
    }

    // finally, if one pointer is a tree and the other is a leaf, simply step into the tree
    if (left.isLeaf() && right.isTree()) {
      diff.recordNewCid(right.pointer)
      await rightWalker.stepInto()
      continue
    } else if (left.isTree() && right.isLeaf()) {
      diff.recordRemovedCid(left.pointer)
      await leftWalker.stepInto()
      continue
    }

    throw new Error('Unidentifiable case in diff walk')
  }
  return diff
}
