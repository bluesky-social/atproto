import { CID } from 'multiformats/cid'
import { BlobStore, Repo } from '@atproto/repo'
import * as auth from '@atproto/auth'
import Database from '../db'
import SqlBlockstore from '../sql-blockstore'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { PreparedCreate, PreparedWrites } from './types'
import { processWriteBlobs } from './blobs'

export const createRepo = async (
  dbTxn: Database,
  did: string,
  authStore: auth.AuthStore,
  writes: PreparedCreate[],
  now: string,
) => {
  dbTxn.assertTransaction()
  const blockstore = new SqlBlockstore(dbTxn, did, now)
  const writeOps = writes.map((write) => write.op)
  const repo = await Repo.create(blockstore, did, authStore, writeOps)
  await dbTxn.db
    .insertInto('repo_root')
    .values({
      did: did,
      root: repo.cid.toString(),
      indexedAt: now,
    })
    .execute()
}

export const processWrites = async (
  dbTxn: Database,
  did: string,
  authStore: auth.AuthStore,
  blobs: BlobStore,
  writes: PreparedWrites,
  now: string,
) => {
  // make structural write to repo & send to indexing
  // @TODO get commitCid first so we can do all db actions in tandem
  const [commit] = await Promise.all([
    writeToRepo(dbTxn, did, authStore, writes, now),
    indexWrites(dbTxn, writes, now),
  ])
  // make blobs permanent & associate w commit + recordUri in DB
  await processWriteBlobs(dbTxn, blobs, did, commit, writes)
}

export const writeToRepo = async (
  dbTxn: Database,
  did: string,
  authStore: auth.AuthStore,
  writes: PreparedWrites,
  now: string,
): Promise<CID> => {
  dbTxn.assertTransaction()
  const blockstore = new SqlBlockstore(dbTxn, did, now)
  const currRoot = await dbTxn.getRepoRoot(did, true)
  if (!currRoot) {
    throw new InvalidRequestError(
      `${did} is not a registered repo on this server`,
    )
  }
  const writeOps = writes.map((write) => write.op)
  const repo = await Repo.load(blockstore, currRoot)
  const updated = await repo
    .stageUpdate(writeOps)
    .createCommit(authStore, async (prev, curr) => {
      const success = await dbTxn.updateRepoRoot(did, curr, prev, now)
      if (!success) {
        throw new Error('Repo root update failed, could not linearize')
      }
      return null
    })
  return updated.cid
}

export const indexWrites = async (
  dbTxn: Database,
  writes: PreparedWrites,
  now: string,
) => {
  dbTxn.assertTransaction()
  await Promise.all(
    writes.map(async (write) => {
      if (write.action === 'create') {
        await dbTxn.indexRecord(write.uri, write.cid, write.op.value, now)
      } else if (write.action === 'delete') {
        await dbTxn.deleteRecord(write.uri)
      }
    }),
  )
}
