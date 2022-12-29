import { MemoryBlockstore, RepoStorage } from './storage'
import DataDiff from './data-diff'
import Repo from './repo'
import * as verify from './verify'
import { DidResolver } from '@atproto/did-resolver'
import * as util from './util'
import { CommitData, RecordWriteOp } from './types'
import { CID } from 'multiformats/cid'
import CidSet from './cid-set'

export const loadFullRepo = async (
  storage: RepoStorage,
  repoCar: Uint8Array,
  didResolver: DidResolver,
): Promise<{ root: CID; ops: RecordWriteOp[] }> => {
  const { root, blocks } = await util.readCar(repoCar)
  const updateStorage = new MemoryBlockstore(blocks)
  const updates = await verify.verifyFullHistory(
    updateStorage,
    root,
    didResolver,
  )

  const newCids = new CidSet()
  const fullDiff = new DataDiff()
  for (const update of updates) {
    newCids.addSet(update.newCids)
    fullDiff.addDiff(update.diff)
  }

  const diffBlocks = await updateStorage.getBlocks(newCids.toList())
  const commits: CommitData[] = updates.map((update) => ({
    root: update.root,
    prev: update.prev,
    blocks: diffBlocks.getMany(update.newCids.toList()),
  }))

  await Promise.all([storage.indexCommits(commits), storage.updateHead(root)])
  const ops = await util.diffToWriteOps(fullDiff, diffBlocks)

  return {
    root,
    ops,
  }
}

export const loadDiff = async (
  repo: Repo,
  diffCar: Uint8Array,
  didResolver: DidResolver,
): Promise<{ root: CID; ops: RecordWriteOp[] }> => {
  const { root, blocks } = await util.readCar(diffCar)
  const updateStorage = new MemoryBlockstore(blocks)
  const updates = await verify.verifyUpdates(
    repo,
    updateStorage,
    root,
    didResolver,
  )

  const newCids = new CidSet()
  const fullDiff = new DataDiff()
  for (const update of updates) {
    newCids.addSet(update.newCids)
    fullDiff.addDiff(update.diff)
  }

  const diffBlocks = await updateStorage.getBlocks(newCids.toList())
  const commits: CommitData[] = updates.map((update) => ({
    root: update.root,
    prev: update.prev,
    blocks: diffBlocks.getMany(update.newCids.toList()),
  }))

  await Promise.all([
    repo.storage.indexCommits(commits),
    repo.storage.updateHead(root),
  ])

  const ops = await util.diffToWriteOps(fullDiff, diffBlocks)

  return {
    root,
    ops,
  }
}
