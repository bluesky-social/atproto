import { MemoryBlockstore, RepoStorage } from './storage'
import { DataDiff } from './mst'
import Repo from './repo'
import * as verify from './verify'
import { DidResolver } from '@atproto/did-resolver'
import * as util from './util'
import { CommitData, RecordWriteOp } from './types'

export const loadRepoFromCar = async (
  storage: RepoStorage,
  updates: Uint8Array,
  didResolver: DidResolver,
): Promise<Repo> => {
  await verify.verifyUpdates(storage, updates, didResolver)
  return Repo.load(storage, root)
}

export const loadDiff = async (
  repo: Repo,
  diffCar: Uint8Array,
  didResolver: DidResolver,
): Promise<{ repo: Repo; ops: RecordWriteOp[] }> => {
  const { root, blocks } = await util.readCar(diffCar)
  const updateStorage = new MemoryBlockstore(blocks)
  const updates = await verify.verifyUpdates(
    repo,
    updateStorage,
    root,
    didResolver,
  )
  const fullDiff = updates.reduce((acc, cur) => {
    acc.addDiff(cur.diff)
    return acc
  }, new DataDiff())
  const diffBlocks = await updateStorage.getBlocks(fullDiff.newCidList())
  const commits: CommitData[] = updates.map((update) => ({
    root: update.root,
    prev: update.prev,
    blocks: diffBlocks.getMany(update.diff.newCidList()),
  }))

  await Promise.all([
    repo.storage.indexCommits(commits),
    repo.storage.updateHead(root),
  ])

  const ops = await util.diffToWriteOps(fullDiff, diffBlocks)

  return {
    repo: await Repo.load(repo.storage, root),
    ops,
  }
}
