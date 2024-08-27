import type { RepoRecord } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'
import type { CID } from 'multiformats/cid'

export type Event = CommitEvt | IdentityEvt | AccountEvt

export type CommitMeta = {
  seq: number
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

export type IdentityEvt = {
  seq: number
  event: 'identity'
  did: string
  handle?: string
}

export type AccountEvt = {
  seq: number
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
