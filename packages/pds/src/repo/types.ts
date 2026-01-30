import { BlobRef, Cid, LexMap } from '@atproto/lex-data'
import { BlockMap, CommitData, WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'

export type ValidationStatus = 'valid' | 'unknown'

export type PreparedCreate = {
  action: WriteOpAction.Create
  uri: AtUri
  cid: Cid
  swapCid?: Cid | null
  record: LexMap
  blobs: BlobRef[]
  validationStatus?: ValidationStatus
}

export type PreparedUpdate = {
  action: WriteOpAction.Update
  uri: AtUri
  cid: Cid
  swapCid?: Cid | null
  record: LexMap
  blobs: BlobRef[]
  validationStatus?: ValidationStatus
}

export type PreparedDelete = {
  action: WriteOpAction.Delete
  uri: AtUri
  swapCid?: Cid | null
}

export type CommitOp = {
  action: 'create' | 'update' | 'delete'
  path: string
  cid: Cid | null
  prev?: Cid
}

export type CommitDataWithOps = CommitData & {
  ops: CommitOp[]
  prevData: Cid | null
}

export type PreparedWrite = PreparedCreate | PreparedUpdate | PreparedDelete

export type SyncEvtData = {
  cid: Cid
  rev: string
  blocks: BlockMap
}

export class InvalidRecordError extends Error {}

export class BadCommitSwapError extends Error {
  constructor(public cid: Cid) {
    super(`Commit was at ${cid.toString()}`)
  }
}

export class BadRecordSwapError extends Error {
  constructor(public cid: Cid | null) {
    super(`Record was at ${cid?.toString() ?? 'null'}`)
  }
}
