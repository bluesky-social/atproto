import { CID } from 'multiformats/cid'
import { DidResolver } from '@atproto/did-resolver'
import { MemoryBlockstore, RepoStorage } from '../storage'
import Repo from '../repo'
import * as verify from '../verify'
import * as util from '../util'
import { CommitData, RepoContents, WriteLog } from '../types'
import CidSet from '../cid-set'
import { MissingBlocksError } from '../error'

// Checkouts
// -------------

export const loadCheckout = async (
  storage: RepoStorage,
  repoCar: Uint8Array,
  didResolver: DidResolver,
): Promise<{ root: CID; contents: RepoContents }> => {
  const { root, blocks } = await util.readCarWithRoot(repoCar)
  const updateStorage = new MemoryBlockstore(blocks)
  const checkout = await verify.verifyCheckout(updateStorage, root, didResolver)

  const checkoutBlocks = await updateStorage.getBlocks(
    checkout.newCids.toList(),
  )
  if (checkoutBlocks.missing.length > 0) {
    throw new MissingBlocksError('sync', checkoutBlocks.missing)
  }
  await Promise.all([
    storage.putMany(checkoutBlocks.blocks),
    storage.updateHead(root, null),
  ])

  return {
    root,
    contents: checkout.contents,
  }
}

// Diffs
// -------------

export const loadFullRepo = async (
  storage: RepoStorage,
  repoCar: Uint8Array,
  didResolver: DidResolver,
): Promise<{ root: CID; writeLog: WriteLog }> => {
  const { root, blocks } = await util.readCarWithRoot(repoCar)
  const updateStorage = new MemoryBlockstore(blocks)
  const updates = await verify.verifyFullHistory(
    updateStorage,
    root,
    didResolver,
  )

  const [writeLog] = await Promise.all([
    persistUpdates(storage, updateStorage, updates),
    storage.updateHead(root, null),
  ])

  return {
    root,
    writeLog,
  }
}

export const loadDiff = async (
  repo: Repo,
  diffCar: Uint8Array,
  didResolver: DidResolver,
): Promise<{ root: CID; writeLog: WriteLog }> => {
  const { root, blocks } = await util.readCarWithRoot(diffCar)
  const updateStorage = new MemoryBlockstore(blocks)
  const updates = await verify.verifyUpdates(
    repo,
    updateStorage,
    root,
    didResolver,
  )

  const [writeLog] = await Promise.all([
    persistUpdates(repo.storage, updateStorage, updates),
    repo.storage.updateHead(root, repo.cid),
  ])

  return {
    root,
    writeLog,
  }
}

// Helpers
// -------------

export const persistUpdates = async (
  storage: RepoStorage,
  updateStorage: RepoStorage,
  updates: verify.VerifiedUpdate[],
): Promise<WriteLog> => {
  const newCids = new CidSet()
  for (const update of updates) {
    newCids.addSet(update.newCids)
  }

  const diffBlocks = await updateStorage.getBlocks(newCids.toList())
  if (diffBlocks.missing.length > 0) {
    throw new MissingBlocksError('sync', diffBlocks.missing)
  }
  const commits: CommitData[] = updates.map((update) => {
    const forCommit = diffBlocks.blocks.getMany(update.newCids.toList())
    if (forCommit.missing.length > 0) {
      throw new MissingBlocksError('sync', forCommit.missing)
    }
    return {
      commit: update.commit,
      prev: update.prev,
      blocks: forCommit.blocks,
    }
  })

  await storage.indexCommits(commits)

  return Promise.all(
    updates.map((upd) =>
      util.diffToWriteDescripts(upd.diff, diffBlocks.blocks),
    ),
  )
}
