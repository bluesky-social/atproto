import { TID } from '@atproto/common-web'
import * as crypto from '@atproto/crypto'
import type { Cid } from '@atproto/lex-data'
import {
  BlockMap,
  MST,
  type NodeData,
  Repo,
  VisitedCidError,
  blocksToCarFile,
} from '../src/index.js'
import { MemoryBlockstore } from '../src/storage/index.js'
import * as sync from '../src/sync/index.js'
import * as util from '../src/util.js'

// An MST cannot contain multiple references to the same subtree. These tests
// cover shared subtrees in the traversal and repo verification paths.

const enc = new TextEncoder()

const leafEntry = (key: string, value: Cid, t: Cid | null = null) => ({
  p: 0,
  k: enc.encode(key),
  v: value,
  t,
})

// Two nodes per level, each pointing at both nodes of the level below. The
// walk from the root describes 2^depth leaves from only 2 * depth blocks.
const buildDiamond = async (blocks: BlockMap, depth: number) => {
  const value = await blocks.add({ $type: 'com.example.dummy' })
  let level: Cid[] = []
  for (let j = 0; j < 2; j++) {
    const node: NodeData = {
      l: null,
      e: [leafEntry(`com.example.lvl0/${j}`, value)],
    }
    level.push(await blocks.add(node))
  }
  for (let i = 1; i < depth; i++) {
    const next: Cid[] = []
    for (let j = 0; j < 2; j++) {
      const node: NodeData = {
        l: level[j],
        e: [leafEntry(`com.example.lvl${i}/${j}`, value, level[(j + 1) % 2])],
      }
      next.push(await blocks.add(node))
    }
    level = next
  }
  return level[0]
}

// One wide node whose every entry points at the same long chain of leafless
// nodes: n + m blocks describe n * m node visits.
const buildSharedChain = async (blocks: BlockMap, n: number, m: number) => {
  const value = await blocks.add({ $type: 'com.example.dummy' })
  let chain = await blocks.add({
    l: null,
    e: [leafEntry('com.example.bottom/a', value)],
  })
  for (let i = 0; i < m; i++) {
    chain = await blocks.add({ l: chain, e: [] })
  }
  const e: NodeData['e'] = []
  for (let i = 0; i < n; i++) {
    const key = `com.example.wide/${String(i).padStart(6, '0')}`
    e.push(leafEntry(key, value, chain))
  }
  return blocks.add({ l: null, e })
}

// Serves blocks but reports none of them as stored, so that
// `MST.getUnstoredBlocks` descends instead of returning at the root.
class UnstoredBlockstore extends MemoryBlockstore {
  async has(): Promise<boolean> {
    return false
  }
}

const drain = async <T>(iter: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = []
  for await (const item of iter) out.push(item)
  return out
}

const commitFor = async (
  blocks: BlockMap,
  data: Cid,
  keypair: crypto.Keypair,
) => {
  const commit = await util.signCommit(
    {
      did: 'did:example:repo',
      version: 3,
      rev: TID.nextStr(),
      prev: null,
      data,
    },
    keypair,
  )
  return blocks.add(commit)
}

describe('MST DAG rejection', () => {
  let keypair: crypto.Keypair

  beforeAll(async () => {
    keypair = await crypto.Secp256k1Keypair.create()
  })

  it('rejects a diamond DAG on first import (nullDiff)', async () => {
    const blocks = new BlockMap()
    const root = await buildDiamond(blocks, 40)
    const commit = await commitFor(blocks, root, keypair)
    await expect(
      sync.verifyDiff(null, blocks, commit, undefined, undefined, {
        ensureLeaves: false,
      }),
    ).rejects.toThrow(VisitedCidError)
  })

  it('rejects a diamond DAG diffed against an existing repo (mstDiff)', async () => {
    const storage = new MemoryBlockstore()
    const repo = await Repo.create(storage, 'did:example:repo', keypair)
    const blocks = new BlockMap()
    const root = await buildDiamond(blocks, 40)
    const commit = await commitFor(blocks, root, keypair)
    await expect(
      sync.verifyDiff(repo, blocks, commit, undefined, undefined, {
        ensureLeaves: false,
      }),
    ).rejects.toThrow(VisitedCidError)
  })

  it('rejects leafless subtrees shared between entries', async () => {
    const blocks = new BlockMap()
    const root = await buildSharedChain(blocks, 50, 50)
    const commit = await commitFor(blocks, root, keypair)
    await expect(
      sync.verifyDiff(null, blocks, commit, undefined, undefined, {
        ensureLeaves: false,
      }),
    ).rejects.toThrow(VisitedCidError)
  })

  it('rejects shared subtrees in every full traversal', async () => {
    const blocks = new BlockMap()
    const root = await buildDiamond(blocks, 40)
    const load = () => MST.load(new MemoryBlockstore(blocks), root)

    await expect(load().leaves()).rejects.toThrow(VisitedCidError)
    await expect(load().reachableLeaves()).rejects.toThrow(VisitedCidError)
    await expect(load().allCids()).rejects.toThrow(VisitedCidError)
    await expect(load().paths()).rejects.toThrow(VisitedCidError)
    await expect(load().list()).rejects.toThrow(VisitedCidError)
  })

  it('rejects shared subtrees when streaming blocks', async () => {
    const blocks = new BlockMap()
    // Shallow so that a regression fails the assertion instead of hanging.
    const root = await buildDiamond(blocks, 10)
    const mst = MST.load(new MemoryBlockstore(blocks), root)
    await expect(drain(mst.carBlockStream())).rejects.toThrow(VisitedCidError)
  })

  it('rejects shared subtrees when collecting unstored blocks', async () => {
    const blocks = new BlockMap()
    // Shallow so that a regression fails the assertion instead of hanging.
    const root = await buildDiamond(blocks, 10)
    const mst = MST.load(new UnstoredBlockstore(blocks), root)
    await expect(mst.getUnstoredBlocks()).rejects.toThrow(VisitedCidError)
  })

  it('rejects a shared-subtree repo in verifyRecords', async () => {
    const blocks = new BlockMap()
    const root = await buildDiamond(blocks, 40)
    const commit = await commitFor(blocks, root, keypair)
    const car = await blocksToCarFile(commit, blocks)
    await expect(
      sync.verifyRecords(car, 'did:example:repo', keypair.did()),
    ).rejects.toThrow(VisitedCidError)
  })
})
