import type { Generated } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'
import type { tools } from '../../lexicons/index.js'
import type { InboxSeen } from './inbox_seen.js'

export const inboxNotificationTableName = 'inbox_notification'

export interface InboxNotification {
  id: Generated<number>
  recipientDid: DidString
  reason: tools.ozone.inbox.defs.Notification['reason']
  section: InboxSeen['section']
  target: tools.ozone.inbox.defs.Notification['target']
  body: string | null
  sourceKey: string
  createdAt: DatetimeString
}

export type PartialDB = {
  [inboxNotificationTableName]: InboxNotification
}
