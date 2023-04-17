export const tableName = 'user_notification'

export type NotificationReason =
  | 'like'
  | 'repost'
  | 'follow'
  | 'mention'
  | 'reply'
  | 'quote'

export interface UserNotification {
  userDid: string
  recordUri: string
  recordCid: string
  author: string
  reason: NotificationReason
  reasonSubject: string | null
  indexedAt: string
}

export type PartialDB = { [tableName]: UserNotification }
