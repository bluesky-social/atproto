import { Generated } from 'kysely'

export const tableName = 'expiring_tag'

export interface ExpiringTag {
  id: Generated<number>
  eventId: number
  did: string
  recordPath: string
  tag: string
  expiresAt: string
  createdBy: string
}

export type PartialDB = {
  [tableName]: ExpiringTag
}
