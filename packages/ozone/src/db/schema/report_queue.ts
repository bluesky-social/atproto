import type { Generated } from 'kysely'
import type { DatetimeString, DidString, NsidString } from '@atproto/lex'

export const reportQueueTableName = 'report_queue'

export interface ReportQueue {
  id: Generated<number>
  name: string
  subjectTypes: string[] // ['account'] or ['record'] or ['account', 'record']
  collection: NsidString | null // Collection name (e.g., 'app.bsky.feed.post'), NULL for accounts
  reportTypes: string[] // Array of report reason types (fully qualified NSIDs)
  description: string | null // Optional description of the queue
  recommendedPolicies: string[] // Policy keys recommended for reports in this queue
  createdBy: DidString | 'admin_token' // DID of moderator who created this queue
  createdAt: DatetimeString
  updatedAt: DatetimeString
  enabled: boolean
  deletedAt: string | null // NULL = active, timestamp = soft-deleted
}

export type PartialDB = {
  [reportQueueTableName]: ReportQueue
}
