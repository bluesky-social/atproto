import * as post from './records/post'
import * as like from './records/like'
import * as repost from './records/repost'
import * as follow from './records/follow'
import * as profile from './records/profile'
import * as badge from './records/badge'
import * as notification from './user-notification'

export type DatabaseSchema = PdsTables &
  notification.PartialDB &
  post.PartialDB &
  like.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  profile.PartialDB &
  badge.PartialDB

export type PdsTables = {
  user: User
  repo_root: RepoRoot
  record: Record
  invite_code: InviteCode
  invite_code_use: InviteCodeUse
}

export interface User {
  did: string
  username: string
  email: string
  password: string
  lastSeenNotifs: string
  createdAt: string
}

export interface RepoRoot {
  did: string
  root: string
  indexedAt: string
}

export interface Record {
  uri: string
  did: string
  collection: string
  recordKey: string
  raw: string
  receivedAt: string
  indexedAt: string
}

export interface InviteCode {
  code: string
  availableUses: number
  disabled: 0 | 1
  forUser: string
  createdBy: string
}

export interface InviteCodeUse {
  code: string
  usedBy: string
  usedAt: string
}
