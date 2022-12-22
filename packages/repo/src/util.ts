import { CID } from 'multiformats/cid'
import * as auth from '@atproto/auth'
import Repo from './repo'
import { DataDiff, MST } from './mst'
import { RepoStorage } from './storage'
import { DataStore, RecordWriteOp } from './types'
import BlockMap from './block-map'
import { CarReader } from '@ipld/car/reader'

export const ucanForOperation = async (
  prevData: DataStore,
  newData: DataStore,
  rootDid: string,
  authStore: auth.AuthStore,
): Promise<string> => {
  const diff = await prevData.diff(newData)
  const neededCaps = diff.neededCapabilities(rootDid)
  const ucanForOp = await authStore.createUcanForCaps(rootDid, neededCaps, 30)
  return auth.encodeUcan(ucanForOp)
}

export const readCar = async (
  bytes: Uint8Array,
): Promise<{ root: CID; blocks: BlockMap }> => {
  const car = await CarReader.fromBytes(bytes)
  const roots = await car.getRoots()
  if (roots.length !== 1) {
    throw new Error(`Expected one root, got ${roots.length}`)
  }
  const root = roots[0]
  const blocks = new BlockMap()
  for await (const block of car.blocks()) {
    blocks.set(block.cid, block.bytes)
  }
  return {
    root,
    blocks,
  }
}

export const getWriteOpLog = async (
  storage: RepoStorage,
  latest: CID,
  earliest: CID | null,
): Promise<RecordWriteOp[][]> => {
  const commits = await storage.getCommitPath(latest, earliest)
  if (!commits) throw new Error('Could not find shared history')
  const heads = await Promise.all(commits.map((c) => Repo.load(storage, c)))
  // Turn commit path into list of diffs
  let prev: DataStore = await MST.create(storage) // Empty
  const msts = heads.map((h) => h.data)
  const diffs: DataDiff[] = []
  for (const mst of msts) {
    diffs.push(await prev.diff(mst))
    prev = mst
  }
  // Map MST diffs to write ops
  return Promise.all(diffs.map((diff) => diffToWriteOps(storage, diff)))
}

export const diffToWriteOps = (
  storage: RepoStorage,
  diff: DataDiff,
): Promise<RecordWriteOp[]> => {
  return Promise.all([
    ...diff.addList().map(async (add) => {
      const { collection, rkey } = parseRecordKey(add.key)
      const value = await storage.getUnchecked(add.cid)
      return { action: 'create' as const, collection, rkey, value }
    }),
    ...diff.updateList().map(async (upd) => {
      const { collection, rkey } = parseRecordKey(upd.key)
      const value = await storage.getUnchecked(upd.cid)
      return { action: 'update' as const, collection, rkey, value }
    }),
    ...diff.deleteList().map((del) => {
      const { collection, rkey } = parseRecordKey(del.key)
      return { action: 'delete' as const, collection, rkey }
    }),
  ])
}

export const parseRecordKey = (key: string) => {
  const parts = key.split('/')
  if (parts.length !== 2) throw new Error(`Invalid record key: ${key}`)
  return { collection: parts[0], rkey: parts[1] }
}
