import { Generated } from 'kysely'

export const tableName = 'notification'

export interface Notification {
  id: Generated<number>
  did: string
  recordUri: string
  recordCid: string
  author: string
  reason: string
  reasonSubject: string | null
  sortAt: string
}

export type PartialDB = { [tableName]: Notification }
