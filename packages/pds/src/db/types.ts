import { AtUri } from '@atproto/uri'
import { ValidationResult } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'

export type DbRecordPlugin<T> = {
  collection: string
  validateSchema: (obj: unknown) => ValidationResult
  matchesSchema: (obj: unknown) => obj is T
  insert: (
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp?: string,
  ) => Promise<void>
  delete: (uri: AtUri) => Promise<void>
  notifsForRecord: (uri: AtUri, cid: CID, obj: unknown) => Notification[]
}

export type NotificationsPlugin = {
  process: (notifs: Notification[]) => Promise<void>
  deleteForRecord: (uri: AtUri) => Promise<void>
}

export type Notification = {
  userDid: string
  author: string
  recordUri: string
  recordCid: string
  reason: string
  reasonSubject?: string
}

export type NotificationReason =
  | 'vote'
  | 'repost'
  | 'trend'
  | 'follow'
  | 'invite'
  | 'reply'
