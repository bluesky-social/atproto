import * as auth from '@atproto/auth'
import { CID } from 'multiformats/cid'
import { IpldStore } from './blockstore'
import { DataDiff } from './mst'
import Repo from './repo'
import * as verify from './verify'

export const loadRepoFromCar = async (
  carBytes: Uint8Array,
  blockstore: IpldStore,
  verifier: auth.Verifier,
): Promise<Repo> => {
  const { root } = await blockstore.loadDiff(carBytes, (root: CID) => {
    return verify.verifyUpdates(blockstore, null, root, verifier)
  })
  return Repo.load(blockstore, root)
}

export const loadDiff = async (
  repo: Repo,
  diffCar: Uint8Array,
  verifier: auth.Verifier,
): Promise<{ repo: Repo; diff: DataDiff }> => {
  const blockstore = repo.blockstore
  const { root, diff } = await blockstore.loadDiff(diffCar, (root: CID) => {
    return verify.verifyUpdates(blockstore, repo.cid, root, verifier)
  })
  const updatedRepo = await Repo.load(blockstore, root)
  return {
    repo: updatedRepo,
    diff,
  }
}
