import type { DidString } from '@atproto/lex'

export const inboxNotificationPreferenceTableName =
  'inbox_notification_preference'

export interface InboxNotificationPreference {
  did: DidString
  push: boolean
}

export type PartialDB = {
  [inboxNotificationPreferenceTableName]: InboxNotificationPreference
}
