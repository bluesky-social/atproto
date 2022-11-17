import * as auth from '@atproto/auth'
import { IpldStore } from './blockstore'
import { DataDiff } from './mst'
import Repo from './repo'
import * as verify from './verify'

export const loadRepoFromCar = async (
  carBytes: Uint8Array,
  blockstore: IpldStore,
  verifier: auth.Verifier,
): Promise<Repo> => {
  const root = await blockstore.stageCar(carBytes)
  const repo = await Repo.load(blockstore, root)
  await verify.verifyUpdates(blockstore, null, repo.cid, verifier)
  await blockstore.saveStaged()
  return repo
}

export const loadDiff = async (
  repo: Repo,
  diffCar: Uint8Array,
  verifier: auth.Verifier,
): Promise<{ repo: Repo; diff: DataDiff }> => {
  const blockstore = repo.blockstore
  const root = await blockstore.stageCar(diffCar)
  const diff = await verify.verifyUpdates(
    repo.blockstore,
    repo.cid,
    root,
    verifier,
  )
  const updatedRepo = await Repo.load(blockstore, root)
  await blockstore.saveStaged()
  return {
    repo: updatedRepo,
    diff,
  }
}
