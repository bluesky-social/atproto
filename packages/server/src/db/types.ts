import { AdxUri } from '@adxp/uri'
import { ValidationResult } from '@adxp/lexicon'

export type DbRecordPlugin<T, S> = {
  collection: string
  tableName: string
  get: (uri: AdxUri) => Promise<T | null>
  validateSchema: (obj: unknown) => ValidationResult
  set: (uri: AdxUri, obj: unknown) => Promise<void>
  delete: (uri: AdxUri) => Promise<void>
  translateDbObj: (dbObj: S) => T
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
