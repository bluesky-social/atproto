import { Generated } from 'kysely'

export const reportQueueTableName = 'report_queue'

export interface ReportQueue {
  id: Generated<number>
  name: string
  subjectTypes: string[] // ['account'] or ['record'] or ['account', 'record']
  collection: string | null // Collection name (e.g., 'app.bsky.feed.post'), NULL for accounts
  reportTypes: string[] // Array of report reason types (fully qualified NSIDs)
  createdBy: string // DID of moderator who created this queue
  createdAt: string
  updatedAt: string
  enabled: boolean
  deletedAt: string | null // NULL = active, timestamp = soft-deleted
}

export type PartialDB = {
  [reportQueueTableName]: ReportQueue
}
