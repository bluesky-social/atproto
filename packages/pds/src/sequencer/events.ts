import { z } from 'zod'
import { cborEncode, noUndefinedVals, schema } from '@atproto/common'
import { BlockMap, blocksToCarFile } from '@atproto/repo'
import { AccountStatus } from '../account-manager'
import { CommitDataWithOps } from '../repo'
import { RepoSeqInsert } from './db'

export const formatSeqCommit = async (
  did: string,
  commitData: CommitDataWithOps,
): Promise<RepoSeqInsert> => {
  const blocksToSend = new BlockMap()
  blocksToSend.addMap(commitData.newBlocks)
  blocksToSend.addMap(commitData.relevantBlocks)

  let evt: CommitEvt

  // If event is too big (max 200 ops or 1MB of data)
  if (commitData.ops.length > 200 || blocksToSend.byteSize > 1000000) {
    const justRoot = new BlockMap()
    const rootBlock = blocksToSend.get(commitData.cid)
    if (rootBlock) {
      justRoot.set(commitData.cid, rootBlock)
    }

    evt = {
      rebase: false,
      tooBig: true,
      repo: did,
      commit: commitData.cid,
      rev: commitData.rev,
      since: commitData.since,
      blocks: await blocksToCarFile(commitData.cid, justRoot),
      ops: [],
      blobs: [],
      prevData: commitData.prevData ?? undefined,
    }
  } else {
    evt = {
      rebase: false,
      tooBig: false,
      repo: did,
      commit: commitData.cid,
      rev: commitData.rev,
      since: commitData.since,
      blocks: await blocksToCarFile(commitData.cid, blocksToSend),
      ops: commitData.ops,
      blobs: commitData.blobs.toList(),
      prevData: commitData.prevData ?? undefined,
    }
  }

  return {
    did,
    eventType: 'append' as const,
    event: cborEncode(noUndefinedVals(evt)),
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

export const handleEvt = z.object({
  did: z.string(),
  handle: z.string(),
})
export type HandleEvt = z.infer<typeof handleEvt>

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
type TypedTombstoneEvt = {
  type: 'tombstone'
  seq: number
  time: string
  evt: TombstoneEvt
}
export type SeqEvt =
  | TypedCommitEvt
  | TypedHandleEvt
  | TypedIdentityEvt
  | TypedAccountEvt
  | TypedTombstoneEvt
