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

// The commit format version. Fixed at 1 for this version of the protocol; it
// corresponds to the version in the ctx protocol tag (atproto-space-v1).
export const COMMIT_VERSION = 1

// The context bound into a commit's signature and MAC. `space` is the 3-part
// space URI (at://authority/space/type/skey); `author` is the DID of the repo
// whose records the commit summarizes; `rev` is the commit revision (TID).
export type SpaceContext = {
  space: string
  author: string
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
  ver: number
  sig: Buffer
  rev: string
}
