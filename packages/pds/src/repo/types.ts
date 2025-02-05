import { CID } from 'multiformats/cid'
import { RepoRecord } from '@atproto/lexicon'
import { CidSet, CommitData, WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'

export type ValidationStatus = 'valid' | 'unknown' | undefined

export type BlobConstraint = {
  accept?: string[]
  maxSize?: number
}

export type PreparedBlobRef = {
  cid: CID
  mimeType: string
  constraints: BlobConstraint
}

export type PreparedCreate = {
  action: WriteOpAction.Create
  uri: AtUri
  cid: CID
  swapCid?: CID | null
  record: RepoRecord
  blobs: PreparedBlobRef[]
  validationStatus: ValidationStatus
}

export type PreparedUpdate = {
  action: WriteOpAction.Update
  uri: AtUri
  cid: CID
  swapCid?: CID | null
  record: RepoRecord
  blobs: PreparedBlobRef[]
  validationStatus: ValidationStatus
}

export type PreparedDelete = {
  action: WriteOpAction.Delete
  uri: AtUri
  swapCid?: CID | null
}

export type CommitOp = {
  action: 'create' | 'update' | 'delete'
  path: string
  cid: CID | null
  prev?: CID
}

export type CommitDataWithOps = CommitData & {
  ops: CommitOp[]
  blobs: CidSet
  prevData: CID | null
}

export type PreparedWrite = PreparedCreate | PreparedUpdate | PreparedDelete

export class InvalidRecordError extends Error {}

export class BadCommitSwapError extends Error {
  constructor(public cid: CID) {
    super(`Commit was at ${cid.toString()}`)
  }
}

export class BadRecordSwapError extends Error {
  constructor(public cid: CID | null) {
    super(`Record was at ${cid?.toString() ?? 'null'}`)
  }
}
