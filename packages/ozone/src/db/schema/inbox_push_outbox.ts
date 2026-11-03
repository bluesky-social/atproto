import type { Generated } from 'kysely'
import type { DatetimeString } from '@atproto/lex'

export interface InboxPushOutbox {
  notificationId: number
  createdAt: DatetimeString
  state: Generated<'pending' | 'handedOff' | 'expired' | 'suppressed'>
  leaseToken: string | null
  leaseUntil: Date | null
  attempts: Generated<number>
  finishedAt: Date | null
}

export type PartialDB = {
  inbox_push_outbox: InboxPushOutbox
}
