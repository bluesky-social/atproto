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

export const sequenceCommit = async (
  dbTxn: Database,
  did: string,
  commitData: CommitData,
  writes: PreparedWrite[],
) => {
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
  await dbTxn.db
    .insertInto('repo_seq')
    .values({
      did,
      eventType: 'append',
      event: cborEncode(evt),
      sequencedAt: new Date().toISOString(),
    })
    .execute()
  await dbTxn.notify('repo_seq')
}

export const sequenceRebase = async (
  dbTxn: Database,
  did: string,
  rebaseData: RebaseData,
) => {
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
  const res = await dbTxn.db
    .insertInto('repo_seq')
    .values({
      did,
      eventType: 'rebase',
      event: cborEncode(evt),
      sequencedAt: new Date().toISOString(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  await dbTxn.db
    .updateTable('repo_seq')
    .where('did', '=', did)
    .where('eventType', 'in', ['append', 'rebase'])
    .where('seq', '!=', res.seq)
    .set({ invalidatedBy: res.seq })
    .execute()
  await dbTxn.notify('repo_seq')
}

export const sequenceHandleUpdate = async (
  dbTxn: Database,
  did: string,
  handle: string,
) => {
  const evt: HandleEvt = {
    did,
    handle,
  }
  const res = await dbTxn.db
    .insertInto('repo_seq')
    .values({
      did,
      eventType: 'handle',
      event: cborEncode(evt),
      sequencedAt: new Date().toISOString(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  await dbTxn.db
    .updateTable('repo_seq')
    .where('eventType', '=', 'handle')
    .where('did', '=', did)
    .where('seq', '!=', res.seq)
    .set({ invalidatedBy: res.seq })
    .execute()
  await dbTxn.notify('repo_seq')
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
export type SeqEvt = TypedCommitEvt | TypedHandleEvt
