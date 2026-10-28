import type { Generated } from 'kysely'
import type { DidString } from '@atproto/lex'

export const inboxNotificationPreferenceTableName =
  'inbox_notification_preference'

export interface InboxNotificationPreference {
  did: DidString
  // @NOTE Retained as the fallback for category preferences not yet set.
  push: Generated<boolean>
  reports: Generated<boolean | null>
  account: Generated<boolean | null>
  labels: Generated<boolean | null>
}

export type PartialDB = {
  [inboxNotificationPreferenceTableName]: InboxNotificationPreference
}
