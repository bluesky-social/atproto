import type { Generated } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'

export const tableName = 'expiring_tag'

export interface ExpiringTag {
  id: Generated<number>
  eventId: number
  did: DidString
  recordPath: string
  convoId: string
  tag: string
  expiresAt: DatetimeString
  createdBy: DidString
}

export type PartialDB = {
  [tableName]: ExpiringTag
}
