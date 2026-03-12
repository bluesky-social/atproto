import { DataDiff } from '../data-diff'
import { MST, NodeEntry } from './mst'
import { MstWalker, rightmostLeaf } from './walker'

export type MstDiffOpts = {
  trackPreorder?: boolean
}

// Depth for a tree node in the preorder map: 129 - layer
const emitInsert = async (
  diff: DataDiff,
  node: NodeEntry,
  lpath: string,
): Promise<void> => {
  if (node.isTree()) {
    const layer = await node.getLayer()
    diff.preorderOps.push({
      action: 'insert',
      lpath,
      depth: 129 - layer,
      cid: node.pointer.toString(),
    })
  } else {
    diff.preorderOps.push({
      action: 'insert',
      lpath: node.key,
      depth: 0,
      cid: node.value.toString(),
    })
  }
}

const emitDelete = async (
  diff: DataDiff,
  node: NodeEntry,
  lpath: string,
): Promise<void> => {
  if (node.isTree()) {
    const layer = await node.getLayer()
    diff.preorderOps.push({
      action: 'delete',
      lpath,
      depth: 129 - layer,
    })
  } else {
    diff.preorderOps.push({
      action: 'delete',
      lpath: node.key,
      depth: 0,
    })
  }
}

// When a matching (unchanged) subtree has a different lpath in old vs new tree,
// walk its leftmost spine emitting fixup ops, because those nodes inherit
// lpath from above.
const emitLpathFixups = async (
  diff: DataDiff,
  node: MST,
  oldLpath: string,
  newLpath: string,
): Promise<void> => {
  const depth = 129 - (await node.getLayer())
  diff.preorderOps.push({ action: 'delete', lpath: oldLpath, depth })
  diff.preorderOps.push({
    action: 'insert',
    lpath: newLpath,
    depth,
    cid: node.pointer.toString(),
  })
  const entries = await node.getEntries()
  if (entries.length > 0 && entries[0].isTree()) {
    await emitLpathFixups(diff, entries[0], oldLpath, newLpath)
  }
}

export const nullDiff = async (
  tree: MST,
  trackPreorder: boolean,
): Promise<DataDiff> => {
  const diff = new DataDiff()
  if (!trackPreorder) {
    for await (const entry of tree.walk()) {
      await diff.nodeAdd(entry)
    }
    return diff
  }
  const walker = new MstWalker(tree)
  while (!walker.status.done) {
    const curr = walker.status.curr
    if (curr.isTree()) {
      await diff.nodeAdd(curr)
      await emitInsert(diff, curr, walker.lastLeafKey)
      await walker.stepInto()
    } else {
      diff.leafAdd(curr.key, curr.value)
      await emitInsert(diff, curr, walker.lastLeafKey)
      await walker.advance()
    }
  }
  return diff
}

export const mstDiff = async (
  curr: MST,
  prev: MST | null,
  opts?: MstDiffOpts,
): Promise<DataDiff> => {
  const trackPreorder = opts?.trackPreorder ?? false
  await curr.getPointer()
  if (prev === null) {
    return nullDiff(curr, trackPreorder)
  }

  await prev.getPointer()
  const diff = new DataDiff()

  const leftWalker = new MstWalker(prev)
  const rightWalker = new MstWalker(curr)
  while (!leftWalker.status.done || !rightWalker.status.done) {
    // if one walker is finished, continue walking the other & logging all nodes
    if (leftWalker.status.done && !rightWalker.status.done) {
      await diff.nodeAdd(rightWalker.status.curr)
      if (trackPreorder) {
        await emitInsert(diff, rightWalker.status.curr, rightWalker.lastLeafKey)
      }
      await rightWalker.advance()
      continue
    } else if (!leftWalker.status.done && rightWalker.status.done) {
      await diff.nodeDelete(leftWalker.status.curr)
      if (trackPreorder) {
        await emitDelete(diff, leftWalker.status.curr, leftWalker.lastLeafKey)
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
          diff.leafUpdate(left.key, left.value, right.value)
          if (trackPreorder) {
            await emitDelete(diff, left, leftWalker.lastLeafKey)
            await emitInsert(diff, right, rightWalker.lastLeafKey)
          }
        }
        await leftWalker.advance()
        await rightWalker.advance()
      } else if (left.key < right.key) {
        diff.leafDelete(left.key, left.value)
        if (trackPreorder) {
          await emitDelete(diff, left, leftWalker.lastLeafKey)
        }
        await leftWalker.advance()
      } else {
        diff.leafAdd(right.key, right.value)
        if (trackPreorder) {
          await emitInsert(diff, right, rightWalker.lastLeafKey)
        }
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
        await diff.nodeAdd(right)
        if (trackPreorder) {
          await emitInsert(diff, right, rightWalker.lastLeafKey)
        }
        await rightWalker.advance()
      } else {
        await diff.nodeDelete(left)
        if (trackPreorder) {
          await emitDelete(diff, left, leftWalker.lastLeafKey)
        }
        await leftWalker.stepInto()
      }
      continue
    } else if (leftWalker.layer() < rightWalker.layer()) {
      if (right.isLeaf()) {
        await diff.nodeDelete(left)
        if (trackPreorder) {
          await emitDelete(diff, left, leftWalker.lastLeafKey)
        }
        await leftWalker.advance()
      } else {
        await diff.nodeAdd(right)
        if (trackPreorder) {
          await emitInsert(diff, right, rightWalker.lastLeafKey)
        }
        await rightWalker.stepInto()
      }
      continue
    }

    // if we're on the same level, and both pointers are trees, do a comparison
    // if they're the same, step over. if they're different, step in to find the subdiff
    if (left.isTree() && right.isTree()) {
      if (left.pointer.equals(right.pointer)) {
        if (trackPreorder) {
          // Unchanged subtree — but lpath may have changed
          if (leftWalker.lastLeafKey !== rightWalker.lastLeafKey) {
            await emitLpathFixups(
              diff,
              left,
              leftWalker.lastLeafKey,
              rightWalker.lastLeafKey,
            )
          }
          // Update lastLeafKey to rightmost leaf of skipped subtree
          const rk = await rightmostLeaf(left)
          if (rk !== null) {
            leftWalker.lastLeafKey = rk
            rightWalker.lastLeafKey = rk
          }
        }
        await leftWalker.stepOver()
        await rightWalker.stepOver()
      } else {
        await diff.nodeAdd(right)
        await diff.nodeDelete(left)
        if (trackPreorder) {
          await emitDelete(diff, left, leftWalker.lastLeafKey)
          await emitInsert(diff, right, rightWalker.lastLeafKey)
        }
        await leftWalker.stepInto()
        await rightWalker.stepInto()
      }
      continue
    }

    // finally, if one pointer is a tree and the other is a leaf, simply step into the tree
    if (left.isLeaf() && right.isTree()) {
      await diff.nodeAdd(right)
      if (trackPreorder) {
        await emitInsert(diff, right, rightWalker.lastLeafKey)
      }
      await rightWalker.stepInto()
      continue
    } else if (left.isTree() && right.isLeaf()) {
      await diff.nodeDelete(left)
      if (trackPreorder) {
        await emitDelete(diff, left, leftWalker.lastLeafKey)
      }
      await leftWalker.stepInto()
      continue
    }

    throw new Error('Unidentifiable case in diff walk')
  }
  return diff
}
