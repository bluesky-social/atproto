import * as auth from '@atproto/auth'
import { CID } from 'multiformats/cid'
import { RepoStorage } from './storage'
import { DataDiff } from './mst'
import Repo from './repo'
import * as verify from './verify'

export const loadRepoFromCar = async (
  carBytes: Uint8Array,
  storage: RepoStorage,
  verifier: auth.Verifier,
): Promise<Repo> => {
  const { root } = await storage.loadDiff(carBytes, (root: CID) => {
    return verify.verifyUpdates(storage, null, root, verifier)
  })
  return Repo.load(storage, root)
}

export const loadDiff = async (
  repo: Repo,
  diffCar: Uint8Array,
  verifier: auth.Verifier,
): Promise<{ repo: Repo; diff: DataDiff }> => {
  const storage = repo.storage
  const { root, diff } = await storage.loadDiff(diffCar, (root: CID) => {
    return verify.verifyUpdates(storage, repo.cid, root, verifier)
  })
  const updatedRepo = await Repo.load(storage, root)
  return {
    repo: updatedRepo,
    diff,
  }
}
