import Database from '../db'
import { z } from 'zod'
import { cborEncode, schema } from '@atproto/common'
import {
  BlockMap,
  blocksToCarFile,
  CidSet,
  CommitData,
  RebaseData,
  WriteOpAction,
} from '@atproto/repo'
import { PreparedWrite } from '../repo'
import { CID } from 'multiformats/cid'
import { EventType, RepoSeqInsert } from '../db/tables/repo-seq'

export const sequenceEvt = async (dbTxn: Database, evt: RepoSeqInsert) => {
  dbTxn.assertTransaction()
  await dbTxn.notify('new_repo_event')
  if (evt.eventType === 'rebase') {
    await invalidatePrevRepoOps(dbTxn, evt.did)
  } else if (evt.eventType === 'handle') {
    await invalidatePrevHandleOps(dbTxn, evt.did)
  }

  const res = await dbTxn.db
    .insertInto('repo_seq')
    .values(evt)
    .returning('id')
    .executeTakeFirst()

  // since sqlite is serializable, sequence right after insert instead of relying on sequencer-leader
  if (res && dbTxn.dialect === 'sqlite') {
    await dbTxn.db
      .updateTable('repo_seq')
      .set({ seq: res.id })
      .where('id', '=', res.id)
      .execute()
    await dbTxn.notify('outgoing_repo_seq')
  }
}

export const formatSeqCommit = async (
  did: string,
  commitData: CommitData,
  writes: PreparedWrite[],
): Promise<RepoSeqInsert> => {
  let tooBig: boolean
  const ops: CommitEvtOp[] = []
  const blobs = new CidSet()
  let carSlice: Uint8Array

  // max 200 ops or 1MB of data
  if (writes.length > 200 || commitData.blocks.byteSize > 1000000) {
    tooBig = true
    const justRoot = new BlockMap()
    justRoot.add(commitData.blocks.get(commitData.commit))
    carSlice = await blocksToCarFile(commitData.commit, justRoot)
  } else {
    tooBig = false
    for (const w of writes) {
      const path = w.uri.collection + '/' + w.uri.rkey
      let cid: CID | null
      if (w.action === WriteOpAction.Delete) {
        cid = null
      } else {
        cid = w.cid
        w.blobs.forEach((blob) => {
          blobs.add(blob.cid)
        })
      }
      ops.push({ action: w.action, path, cid })
    }
    carSlice = await blocksToCarFile(commitData.commit, commitData.blocks)
  }

  const evt: CommitEvt = {
    rebase: false,
    tooBig,
    repo: did,
    commit: commitData.commit,
    prev: commitData.prev,
    ops,
    blocks: carSlice,
    blobs: blobs.toList(),
  }
  return {
    did,
    eventType: 'append' as const,
    event: cborEncode(evt),
    sequencedAt: new Date().toISOString(),
  }
}

export const formatSeqRebase = async (
  did: string,
  rebaseData: RebaseData,
): Promise<RepoSeqInsert> => {
  const carSlice = await blocksToCarFile(rebaseData.commit, rebaseData.blocks)

  const evt: CommitEvt = {
    rebase: true,
    tooBig: false,
    repo: did,
    commit: rebaseData.commit,
    prev: rebaseData.rebased,
    ops: [],
    blocks: carSlice,
    blobs: [],
  }
  return {
    did,
    eventType: 'rebase',
    event: cborEncode(evt),
    sequencedAt: new Date().toISOString(),
  }
}

export const formatSeqHandleUpdate = async (
  did: string,
  handle: string,
): Promise<RepoSeqInsert> => {
  const evt: HandleEvt = {
    did,
    handle,
  }
  return {
    did,
    eventType: 'handle',
    event: cborEncode(evt),
    sequencedAt: new Date().toISOString(),
  }
}

export const formatSeqTombstone = async (
  did: string,
): Promise<RepoSeqInsert> => {
  const evt: TombstoneEvt = {
    did,
  }
  return {
    did,
    eventType: 'tombstone',
    event: cborEncode(evt),
    sequencedAt: new Date().toISOString(),
  }
}

export const invalidatePrevSeqEvts = async (
  db: Database,
  did: string,
  eventTypes: EventType[],
) => {
  if (eventTypes.length < 1) return
  await db.db
    .updateTable('repo_seq')
    .where('did', '=', did)
    .where('eventType', 'in', eventTypes)
    .where('invalidated', '=', 0)
    .set({ invalidated: 1 })
    .execute()
}

export const invalidatePrevRepoOps = async (db: Database, did: string) => {
  return invalidatePrevSeqEvts(db, did, ['append', 'rebase'])
}

export const invalidatePrevHandleOps = async (db: Database, did: string) => {
  return invalidatePrevSeqEvts(db, did, ['handle'])
}

export const commitEvtOp = z.object({
  action: z.union([
    z.literal('create'),
    z.literal('update'),
    z.literal('delete'),
  ]),
  path: z.string(),
  cid: schema.cid.nullable(),
})
export type CommitEvtOp = z.infer<typeof commitEvtOp>

export const commitEvt = z.object({
  rebase: z.boolean(),
  tooBig: z.boolean(),
  repo: z.string(),
  commit: schema.cid,
  prev: schema.cid.nullable(),
  blocks: schema.bytes,
  ops: z.array(commitEvtOp),
  blobs: z.array(schema.cid),
})
export type CommitEvt = z.infer<typeof commitEvt>

export const handleEvt = z.object({
  did: z.string(),
  handle: z.string(),
})
export type HandleEvt = z.infer<typeof handleEvt>

export const tombstoneEvt = z.object({
  did: z.string(),
})
export type TombstoneEvt = z.infer<typeof tombstoneEvt>

type TypedCommitEvt = {
  type: 'commit'
  seq: number
  time: string
  evt: CommitEvt
}
type TypedHandleEvt = {
  type: 'handle'
  seq: number
  time: string
  evt: HandleEvt
}
type TypedTombstoneEvt = {
  type: 'tombstone'
  seq: number
  time: string
  evt: TombstoneEvt
}
export type SeqEvt = TypedCommitEvt | TypedHandleEvt | TypedTombstoneEvt
