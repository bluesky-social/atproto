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
  rev: string
  scope: 'records' | 'members'
}

export type UnsignedCommit = {
  hash: Buffer
  hmac: Buffer
  ikm: Buffer
}

// `rev` rides along on the commit because it's part of the HKDF info — a
// reader needs it to reconstruct the SpaceContext used for HMAC verification.
export type SignedCommit = UnsignedCommit & {
  sig: Buffer
  rev: string
}

export enum MemberOpAction {
  Add = 'add',
  Remove = 'remove',
}

export type MemberAddOp = {
  action: MemberOpAction.Add
  did: string
}

export type MemberRemoveOp = {
  action: MemberOpAction.Remove
  did: string
}

export type MemberWriteOp = MemberAddOp | MemberRemoveOp

export type PreparedMemberOp = MemberAddOp | MemberRemoveOp

export type MemberCommitData = {
  ops: PreparedMemberOp[]
  setHash: Buffer
}
