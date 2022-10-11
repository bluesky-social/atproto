import { AdxUri } from '@adxp/uri'
import { ValidationResult } from '@adxp/lexicon'

export type DbRecordPlugin<T, S> = {
  collection: string
  tableName: string
  validateSchema: (obj: unknown) => ValidationResult
  translateDbObj: (dbObj: S) => T
  get: (uri: AdxUri) => Promise<T | null>
  insert: (uri: AdxUri, obj: unknown) => Promise<void>
  delete: (uri: AdxUri) => Promise<void>
  notifsForRecord: (uri: AdxUri, obj: unknown) => Notification[]
}

export type NotificationsPlugin = {
  process: (notifs: Notification[]) => Promise<void>
  deleteForRecord: (uri: AdxUri) => Promise<void>
}

export type Notification = {
  userDid: string
  author: string
  recordUri: string
  reason: string
  reasonSubject?: string
}

export type NotificationReason =
  | 'like'
  | 'repost'
  | 'follow'
  | 'badge'
  | 'mention'
  | 'reply'
