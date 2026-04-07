import { Cid, LexMap } from '@atproto/lex-data'

export type RepoRecord = LexMap

export enum WriteOpAction {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export type RecordCreateOp = {
  action: WriteOpAction.Create
  collection: string
  rkey: string
  record: RepoRecord
}

export type RecordUpdateOp = {
  action: WriteOpAction.Update
  collection: string
  rkey: string
  record: RepoRecord
}

export type RecordDeleteOp = {
  action: WriteOpAction.Delete
  collection: string
  rkey: string
}

export type RecordWriteOp = RecordCreateOp | RecordUpdateOp | RecordDeleteOp

export type PreparedCreate = {
  action: WriteOpAction.Create
  collection: string
  rkey: string
  record: RepoRecord
  cid: Cid
}

export type PreparedUpdate = {
  action: WriteOpAction.Update
  collection: string
  rkey: string
  record: RepoRecord
  cid: Cid
}

export type PreparedDelete = {
  action: WriteOpAction.Delete
  collection: string
  rkey: string
}

export type PreparedWrite = PreparedCreate | PreparedUpdate | PreparedDelete

export type CommitData = {
  writes: PreparedWrite[]
  setHash: Buffer
}

export type SpaceContext = {
  spaceDid: string
  spaceType: string
  spaceKey: string
  userDid: string
  rev: number
}

export type UnsignedCommit = {
  hash: Buffer
  hmac: Buffer
  ikm: Buffer
}

export type SignedCommit = UnsignedCommit & {
  sig: Buffer
}
