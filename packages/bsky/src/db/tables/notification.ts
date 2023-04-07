export const tableName = 'notification'

export interface Notification {
  did: string
  recordUri: string
  recordCid: string
  author: string
  reason: string
  reasonSubject: string | null
  sortAt: string
}

export type PartialDB = { [tableName]: Notification }
