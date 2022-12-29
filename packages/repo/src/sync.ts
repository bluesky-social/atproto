import { CID } from 'multiformats/cid'
import { MemoryBlockstore, RepoStorage } from './storage'
import { DataDiff } from './mst'
import Repo from './repo'
import * as verify from './verify'
import { DidResolver } from '@atproto/did-resolver'
import * as util from './util'
import TempStorage from './storage/temp-storage'

export const loadRepoFromCar = async (
  carBytes: Uint8Array,
  storage: RepoStorage,
  didResolver: DidResolver,
): Promise<Repo> => {
  const { root, blocks } = await util.readCar(carBytes)
  const memoryBlocks = new MemoryBlockstore(blocks)
  const tempStorage = new TempStorage(memoryBlocks, storage)
  await verify.verifyUpdates(tempStorage, root, null, didResolver)
  return Repo.load(storage, root)
}

export const loadDiff = async (
  repo: Repo,
  diffCar: Uint8Array,
  didResolver: DidResolver,
): Promise<{ repo: Repo; diff: DataDiff }> => {
  const storage = repo.storage
  const { root, diff } = await storage.loadDiff(diffCar, (root: CID) => {
    return verify.verifyUpdates(storage, root, repo.cid, didResolver)
  })
  const updatedRepo = await Repo.load(storage, root)
  return {
    repo: updatedRepo,
    diff,
  }
}
