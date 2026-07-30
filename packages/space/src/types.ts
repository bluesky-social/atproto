import { Cid, LexMap } from '@atproto/lex-data'

export type SpaceRecord = LexMap

export type RecordPath = {
  collection: string
  rkey: string
}

// A create has no `prev`, a delete no `cid`, an update both.
export type RepoOp = RecordPath & {
  cid: Cid | null
  prev: Cid | null
}

export const COMMIT_VERSION = 1

export type CommitCtx = {
  space: string
  author: string
  rev: string
}

export type SignedCommit = {
  ver: number
  hash: Uint8Array
  ikm: Uint8Array
  sig: Uint8Array
  mac: Uint8Array
  rev: string
}
