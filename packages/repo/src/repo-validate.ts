import type { Cid } from '@atproto/lex-data'
import { isValidNsid, isValidRecordKey } from '@atproto/syntax'
import { CidSet } from './cid-set.js'
import { RepoVerificationError } from './error.js'
import { nodeDataDef } from './mst/mst.js'
import {
  countPrefixLen,
  isValidMstKey,
  leadingZerosOnHash,
} from './mst/util.js'
import type { ReadableBlockstore } from './storage/index.js'

const utf8 = new TextDecoder()

const ascii = (bytes: Uint8Array): string => utf8.decode(bytes)

const LOWERCASE_AUTHORITY = /^[a-z0-9.-]+\.[a-zA-Z][a-zA-Z0-9]*$/

/**
 * A normalized NSID has a lowercase domain authority (all segments but the
 * name); the name segment is case-sensitive and must not be lowercased.
 */
const isNormalizedNsid = (nsid: string): boolean =>
  isValidNsid(nsid) && LOWERCASE_AUTHORITY.test(nsid)

/**
 * Walks every node of the MST at `rootCid` and enforces the repository
 * invariants that CID-consistency and signature checks cannot see:
 *
 * - every record key is a `collection/rkey` path whose collection is a
 *   valid, normalized NSID (lowercase domain authority) and whose rkey is
 *   a valid record key string
 * - keys appear in strictly ascending order across the in-order traversal,
 *   which is equivalent to every key falling inside the bounds of the
 *   subtree link that reaches it
 * - every leaf sits on the MST layer its key hash selects: a leaf's
 *   `leadingZerosOnHash(key)` plus its depth must be the same for every
 *   leaf in the tree
 * - every node entry uses the longest shared prefix with the preceding
 *   key, so each key/value mapping has exactly one accepted encoding
 * - the MST is pruned: the top node may not consist solely of a sub-tree
 *   link, and no non-root node may be empty
 * - the MST is a tree: no node CID may be referenced twice
 *
 * The walk is iterative and reads raw node blocks, so it does not depend
 * on `MST`'s lenient loading behavior. The first violation is recorded
 * and reported after the walk completes, so that a repeated node CID
 * surfaces as `VisitedCidError` even when the tree also violates a content
 * invariant. Missing or malformed blocks surface as blockstore or decode
 * errors.
 */
export const assertValidRepoStructure = async (
  storage: ReadableBlockstore,
  rootCid: Cid,
): Promise<void> => {
  const seen = new CidSet()
  type Step =
    | { type: 'node'; cid: Cid; depth: number }
    | { type: 'leaf'; key: string; depth: number }
  const stack: Step[] = [{ type: 'node', cid: rootCid, depth: 0 }]

  let prevKey: string | null = null
  let impliedRootLayer: number | null = null
  let violation: string | null = null
  const fail = (msg: string) => {
    violation ??= msg
  }

  while (stack.length > 0) {
    const step = stack.pop() as Step

    if (step.type === 'leaf') {
      const { key, depth } = step
      if (!isValidMstKey(key)) {
        fail(`invalid record key: ${key}`)
      } else {
        const collection = key.slice(0, key.indexOf('/'))
        const rkey = key.slice(key.indexOf('/') + 1)
        if (!isNormalizedNsid(collection)) {
          fail(`collection is not a normalized NSID in key: ${key}`)
        }
        if (!isValidRecordKey(rkey)) {
          fail(`invalid record key in path: ${key}`)
        }
      }
      if (prevKey !== null && key <= prevKey) {
        fail(`record keys out of order: ${prevKey} >= ${key}`)
      }
      prevKey = key
      const implied = (await leadingZerosOnHash(key)) + depth
      if (impliedRootLayer === null) {
        impliedRootLayer = implied
      } else if (implied !== impliedRootLayer) {
        fail(`key sits on the wrong MST layer: ${key}`)
      }
      continue
    }

    // A repeated node CID means the MST is a DAG, which is invalid; let
    // VisitedCidError propagate as-is.
    seen.markVisited(step.cid)

    const node = await storage.readObj(step.cid, nodeDataDef)

    // Empty-node pruning: the top node may not consist solely of a sub-tree
    // link, and no non-root node may be empty (no entries, no sub-tree).
    // Empty intermediate nodes that do point to entries are allowed.
    if (step.depth === 0) {
      if (node.e.length === 0 && node.l !== null) {
        fail(`top MST node only points to a sub-tree: ${step.cid}`)
      }
    } else if (node.e.length === 0 && node.l === null) {
      fail(`empty MST node: ${step.cid}`)
    }

    // Decode this node's entries, checking prefix compression against the
    // previously decoded key in the same node.
    const leafKeys: string[] = []
    const subtreeCids: (Cid | null)[] = []
    let lastKey = ''
    for (const entry of node.e) {
      const key = lastKey.slice(0, entry.p) + ascii(entry.k)
      if (countPrefixLen(lastKey, key) !== entry.p) {
        fail(`non-canonical prefix compression in node ${step.cid}`)
      }
      leafKeys.push(key)
      subtreeCids.push(entry.t)
      lastKey = key
    }

    // In-order sequence is: leftmost subtree, then for each entry its leaf
    // followed by its right subtree. Push reversed so pops yield that order.
    for (let i = leafKeys.length - 1; i >= 0; i--) {
      const t = subtreeCids[i]
      if (t !== null) {
        stack.push({ type: 'node', cid: t, depth: step.depth + 1 })
      }
      stack.push({ type: 'leaf', key: leafKeys[i], depth: step.depth })
    }
    if (node.l !== null) {
      stack.push({ type: 'node', cid: node.l, depth: step.depth + 1 })
    }
  }

  if (violation !== null) {
    throw new RepoVerificationError(`invalid repo structure: ${violation}`)
  }
}
