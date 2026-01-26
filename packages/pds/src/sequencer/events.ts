import assert from 'node:assert'
import { z } from 'zod'
import { cborEncode, schema } from '@atproto/common'
import { BlockMap, blocksToCarFile } from '@atproto/repo'
import { AccountStatus } from '../account-manager/account-manager'
import { CommitDataWithOps, SyncEvtData } from '../repo'
import { RepoSeqInsert } from './db'

export const formatSeqCommit = async (
  did: string,
  commitData: CommitDataWithOps,
): Promise<RepoSeqInsert> => {
  const blocksToSend = new BlockMap()
  blocksToSend.addMap(commitData.newBlocks)
  blocksToSend.addMap(commitData.relevantBlocks)

  const evt = {
    repo: did,
    commit: commitData.cid,
    rev: commitData.rev,
    since: commitData.since,
    blocks: await blocksToCarFile(commitData.cid, blocksToSend),
    ops: commitData.ops,
    prevData: commitData.prevData ?? undefined,
    // deprecated (but still required) fields
    rebase: false,
    tooBig: false,
    blobs: [],
  }

  return {
    did,
    eventType: 'append' as const,
    event: cborEncode(evt),
    sequencedAt: new Date().toISOString(),
  }
}

export const formatSeqSyncEvt = async (
  did: string,
  data: SyncEvtData,
): Promise<RepoSeqInsert> => {
  const blocks = await blocksToCarFile(data.cid, data.blocks)
  const evt: SyncEvt = {
    did,
    rev: data.rev,
    blocks,
  }
  return {
    did,
    eventType: 'sync',
    event: cborEncode(evt),
    sequencedAt: new Date().toISOString(),
  }
}

export const syncEvtDataFromCommit = (
  commitData: CommitDataWithOps,
): SyncEvtData => {
  const { blocks, missing } = commitData.relevantBlocks.getMany([
    commitData.cid,
  ])
  assert(
    !missing.length,
    'commit block was not found, could not build sync event',
  )
  return {
    rev: commitData.rev,
    cid: commitData.cid,
    blocks,
  }
}

export const formatSeqIdentityEvt = async (
  did: string,
  handle?: string,
): Promise<RepoSeqInsert> => {
  const evt: IdentityEvt = {
    did,
  }
  if (handle) {
    evt.handle = handle
  }
  return {
    did,
    eventType: 'identity',
    event: cborEncode(evt),
    sequencedAt: new Date().toISOString(),
  }
}

export const formatSeqAccountEvt = async (
  did: string,
  status: AccountStatus,
): Promise<RepoSeqInsert> => {
  const evt: AccountEvt = {
    did,
    active: status === 'active',
  }
  if (status !== AccountStatus.Active) {
    evt.status = status
  }

  return {
    did,
    eventType: 'account',
    event: cborEncode(evt),
    sequencedAt: new Date().toISOString(),
  }
}

export const commitEvtOp = z.object({
  action: z.union([
    z.literal('create'),
    z.literal('update'),
    z.literal('delete'),
  ]),
  path: z.string(),
  cid: schema.cid.nullable(),
  prev: schema.cid.optional(),
})
export type CommitEvtOp = z.infer<typeof commitEvtOp>

export const commitEvt = z.object({
  rebase: z.boolean(),
  tooBig: z.boolean(),
  repo: z.string(),
  commit: schema.cid,
  rev: z.string(),
  since: z.string().nullable(),
  blocks: schema.bytes,
  ops: z.array(commitEvtOp),
  blobs: z.array(schema.cid),
  prevData: schema.cid.optional(),
})
export type CommitEvt = z.infer<typeof commitEvt>

export const syncEvt = z.object({
  did: z.string(),
  blocks: schema.bytes,
  rev: z.string(),
})
export type SyncEvt = z.infer<typeof syncEvt>

export const identityEvt = z.object({
  did: z.string(),
  handle: z.string().optional(),
})
export type IdentityEvt = z.infer<typeof identityEvt>

export const accountEvt = z.object({
  did: z.string(),
  active: z.boolean(),
  status: z
    .enum([
      AccountStatus.Takendown,
      AccountStatus.Suspended,
      AccountStatus.Deleted,
      AccountStatus.Deactivated,
    ])
    .optional(),
})
export type AccountEvt = z.infer<typeof accountEvt>

type TypedCommitEvt = {
  type: 'commit'
  seq: number
  time: string
  evt: CommitEvt
}
type TypedSyncEvt = {
  type: 'sync'
  seq: number
  time: string
  evt: SyncEvt
}
type TypedIdentityEvt = {
  type: 'identity'
  seq: number
  time: string
  evt: IdentityEvt
}
type TypedAccountEvt = {
  type: 'account'
  seq: number
  time: string
  evt: AccountEvt
}
export type SeqEvt =
  | TypedCommitEvt
  | TypedSyncEvt
  | TypedIdentityEvt
  | TypedAccountEvt
