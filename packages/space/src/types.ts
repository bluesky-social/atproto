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

// The context bound into a commit's signature and MAC. `space` is the 3-part
// space URI (ats://authority/type/skey); `rev` is the commit revision (TID).
export type SpaceContext = {
  space: string
  rev: string
}

export type UnsignedCommit = {
  hash: Buffer
  mac: Buffer
  ikm: Buffer
}

// `rev` rides along on the commit because it's bound into the signing context —
// a reader needs it to reconstruct the ctx used for signature & MAC verification.
export type SignedCommit = UnsignedCommit & {
  sig: Buffer
  rev: string
}
