import { DidDocument } from '@atproto/identity'
import { Cid, LexMap } from '@atproto/lex'
import { BlockMap } from '@atproto/repo'
import { AtUri, DidString } from '@atproto/syntax'

export type Event = CommitEvt | SyncEvt | IdentityEvt | AccountEvt

export type CommitMeta = {
  seq: number
  time: string
  commit: Cid
  blocks: BlockMap
  rev: string
  uri: AtUri
  did: DidString
  collection: string
  rkey: string
}

export type CommitEvt = Create | Update | Delete

export type Create = CommitMeta & {
  event: 'create'
  record: LexMap
  cid: Cid
}

export type Update = CommitMeta & {
  event: 'update'
  record: LexMap
  cid: Cid
}

export type Delete = CommitMeta & {
  event: 'delete'
}

export type SyncEvt = {
  seq: number
  time: string
  event: 'sync'
  did: DidString
  cid: Cid
  rev: string
  blocks: BlockMap
}

export type IdentityEvt = {
  seq: number
  time: string
  event: 'identity'
  did: DidString
  handle?: string
  didDocument?: DidDocument
}

export type AccountEvt = {
  seq: number
  time: string
  event: 'account'
  did: DidString
  active: boolean
  status?: AccountStatus
}

export type AccountStatus =
  | 'takendown'
  | 'suspended'
  | 'deleted'
  | 'deactivated'
