import type { DatetimeString, DidString } from '@atproto/lex'

export const inboxSeenTableName = 'inbox_seen'

export interface InboxSeen {
  did: DidString
  section: 'reports' | 'subjects' | 'accountStatus'
  seenAt: DatetimeString
}

export type PartialDB = {
  [inboxSeenTableName]: InboxSeen
}
