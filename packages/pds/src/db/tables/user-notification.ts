export const tableName = 'user_notification'
export interface UserNotification {
  userDid: string
  recordUri: string
  recordCid: string
  author: string
  reason: string
  reasonSubject: string | null
  indexedAt: string
}

export type PartialDB = { [tableName]: UserNotification }
