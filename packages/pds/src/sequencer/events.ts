import { z } from 'zod'
import { cborEncode, schema } from '@atproto/common'
import {
  BlockMap,
  blocksToCarFile,
  CidSet,
  CommitData,
  WriteOpAction,
} from '@atproto/repo'
import { PreparedWrite } from '../repo'
import { CID } from 'multiformats/cid'
import { RepoSeqInsert } from './db'
import { AccountStatus } from '../account-manager'

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
  if (writes.length > 200 || commitData.newBlocks.byteSize > 1000000) {
    tooBig = true
    const justRoot = new BlockMap()
    const rootBlock = commitData.newBlocks.get(commitData.cid)
    if (rootBlock) {
      justRoot.set(commitData.cid, rootBlock)
    }
    carSlice = await blocksToCarFile(commitData.cid, justRoot)
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
    carSlice = await blocksToCarFile(commitData.cid, commitData.newBlocks)
  }

  const evt: CommitEvt = {
    rebase: false,
    tooBig,
    repo: did,
    commit: commitData.cid,
    prev: commitData.prev,
    rev: commitData.rev,
    since: commitData.since,
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
})
export type CommitEvtOp = z.infer<typeof commitEvtOp>

export const commitEvt = z.object({
  rebase: z.boolean(),
  tooBig: z.boolean(),
  repo: z.string(),
  commit: schema.cid,
  prev: schema.cid.nullable(),
  rev: z.string(),
  since: z.string().nullable(),
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
