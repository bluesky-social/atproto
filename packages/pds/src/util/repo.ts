import { CID } from 'multiformats/cid'
import {
  DeleteOp,
  RecordCreateOp,
  RecordUpdateOp,
  RecordWriteOp,
  Repo,
} from '@atproto/repo'
import * as auth from '@atproto/auth'
import { AtUri } from '@atproto/uri'
import Database from '../db'
import SqlBlockstore from '../sql-blockstore'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { cidForData } from '@atproto/common'

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

export const writeToRepo = async (
  dbTxn: Database,
  did: string,
  authStore: auth.AuthStore,
  writes: PreparedWrites,
  now: string,
) => {
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
  await repo
    .stageUpdate(writeOps)
    .createCommit(authStore, async (prev, curr) => {
      const success = await dbTxn.updateRepoRoot(did, curr, prev, now)
      if (!success) {
        throw new Error('Repo root update failed, could not linearize')
      }
      return null
    })
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

export type PreparedCreate = {
  action: 'create'
  uri: AtUri
  cid: CID
  op: RecordCreateOp
}

export type PreparedUpdate = {
  action: 'update'
  uri: AtUri
  cid: CID
  op: RecordUpdateOp
}

export type PreparedDelete = {
  action: 'delete'
  uri: AtUri
  op: DeleteOp
}

export type PreparedWrites = (
  | PreparedCreate
  | PreparedUpdate
  | PreparedDelete
)[]

export const prepareCreate = async (
  did: string,
  write: RecordCreateOp,
): Promise<PreparedCreate> => {
  const record = {
    ...write.value,
    $type: write.collection,
  }
  return {
    action: 'create',
    uri: AtUri.make(did, write.collection, write.rkey),
    cid: await cidForData(record),
    op: {
      ...write,
      value: record,
    },
  }
}

export const prepareCreates = async (
  did: string,
  writes: RecordCreateOp[],
): Promise<PreparedCreate[]> => {
  return Promise.all(writes.map((write) => prepareCreate(did, write)))
}

export const prepareUpdate = async (
  did: string,
  write: RecordUpdateOp,
): Promise<PreparedUpdate> => {
  const record = {
    ...write.value,
    $type: write.collection,
  }
  return {
    action: 'update',
    uri: AtUri.make(did, write.collection, write.rkey),
    cid: await cidForData(record),
    op: {
      ...write,
      value: record,
    },
  }
}

export const prepareDelete = (did: string, write: DeleteOp): PreparedDelete => {
  return {
    action: 'delete',
    uri: AtUri.make(did, write.collection, write.rkey),
    op: write,
  }
}

export const prepareWrites = async (
  did: string,
  writes: RecordWriteOp | RecordWriteOp[],
): Promise<PreparedWrites> => {
  const writesArr = Array.isArray(writes) ? writes : [writes]
  return Promise.all(
    writesArr.map((write) => {
      if (write.action === 'create') {
        return prepareCreate(did, write)
      } else if (write.action === 'delete') {
        return prepareDelete(did, write)
      } else if (write.action === 'update') {
        return prepareUpdate(did, write)
      } else {
        throw new Error(`Action not supported: ${write}`)
      }
    }),
  )
}
