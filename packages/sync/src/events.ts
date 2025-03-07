import type { CID } from 'multiformats/cid'
import { DidDocument } from '@atproto/identity'
import type { RepoRecord } from '@atproto/lexicon'
import { BlockMap } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'

export type Event = CommitEvt | SyncEvt | IdentityEvt | AccountEvt

export type CommitMeta = {
  seq: number
  time: string
  commit: CID
  blocks: BlockMap
  rev: string
  uri: AtUri
  did: string
  collection: string
  rkey: string
}

export type CommitEvt = Create | Update | Delete

export type Create = CommitMeta & {
  event: 'create'
  record: RepoRecord
  cid: CID
}

export type Update = CommitMeta & {
  event: 'update'
  record: RepoRecord
  cid: CID
}

export type Delete = CommitMeta & {
  event: 'delete'
}

export type SyncEvt = {
  seq: number
  time: string
  event: 'sync'
  did: string
  cid: CID
  rev: string
  blocks: BlockMap
}

export type IdentityEvt = {
  seq: number
  time: string
  event: 'identity'
  did: string
  handle?: string
  didDocument?: DidDocument
}

export type AccountEvt = {
  seq: number
  time: string
  event: 'account'
  did: string
  active: boolean
  status?: AccountStatus
}

export type AccountStatus =
  | 'takendown'
  | 'suspended'
  | 'deleted'
  | 'deactivated'
