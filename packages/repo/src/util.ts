import { CID } from 'multiformats/cid'
import * as auth from '@atproto/auth'
import Repo from './repo'
import { DataDiff, MST } from './mst'
import { IpldStore } from './blockstore'
import { DataStore, RecordWriteOp, def } from './types'

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

export const getCommitPath = async (
  blockstore: IpldStore,
  earliest: CID | null,
  latest: CID,
): Promise<CID[] | null> => {
  let curr: CID | null = latest
  const path: CID[] = []
  while (curr !== null) {
    path.push(curr)
    const commit = await blockstore.get(curr, def.commit)
    if (earliest && curr.equals(earliest)) {
      return path.reverse()
    }
    const root = await blockstore.get(commit.root, def.repoRoot)
    if (!earliest && root.prev === null) {
      return path.reverse()
    }
    curr = root.prev
  }
  return null
}

export const getWriteOpLog = async (
  blockstore: IpldStore,
  earliest: CID | null,
  latest: CID,
): Promise<RecordWriteOp[][]> => {
  const commits = await getCommitPath(blockstore, earliest, latest)
  if (!commits) throw new Error('Could not find shared history')
  const heads = await Promise.all(commits.map((c) => Repo.load(blockstore, c)))
  // Turn commit path into list of diffs
  let prev: DataStore = await MST.create(blockstore) // Empty
  const msts = heads.map((h) => h.data)
  const diffs: DataDiff[] = []
  for (const mst of msts) {
    diffs.push(await prev.diff(mst))
    prev = mst
  }
  // Map MST diffs to write ops
  return Promise.all(diffs.map((diff) => diffToWriteOps(blockstore, diff)))
}

export const diffToWriteOps = (
  blockstore: IpldStore,
  diff: DataDiff,
): Promise<RecordWriteOp[]> => {
  return Promise.all([
    ...diff.addList().map(async (add) => {
      const { collection, rkey } = parseRecordKey(add.key)
      const value = await blockstore.getUnchecked(add.cid)
      return { action: 'create' as const, collection, rkey, value }
    }),
    ...diff.updateList().map(async (upd) => {
      const { collection, rkey } = parseRecordKey(upd.key)
      const value = await blockstore.getUnchecked(upd.cid)
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
