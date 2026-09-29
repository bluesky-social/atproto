import type { Generated } from 'kysely'
import type { NotificationReason } from '../../../../api/app/bsky/notification/constants.js'

export const tableName = 'notification'

export interface Notification {
  id: Generated<number>
  did: string
  recordUri: string
  recordCid: string
  author: string
  reason: NotificationReason
  reasonSubject: string | null
  sortAt: string
}

export type PartialDB = { [tableName]: Notification }
