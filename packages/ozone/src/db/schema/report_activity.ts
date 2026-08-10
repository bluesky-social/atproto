import type { Generated } from 'kysely'

export const reportActivityTableName = 'report_activity'

export interface ReportActivity {
  id: Generated<number>
  reportId: number
  // One of: queueActivity | assignmentActivity | escalationActivity
  //         | closeActivity | internalNoteActivity | publicNoteActivity
  activityType: string
  previousStatus: string | null // report status before this activity; null for note-only types
  internalNote: string | null // moderator-only note
  publicNote: string | null // potentially reporter-visible note
  meta: unknown | null // loose activity-specific metadata (e.g. { assignmentId: 42 })
  isAutomated: boolean
  createdBy: string // DID of actor (or service DID for automated activities)
  createdAt: string // ISO string
  actionEventIds: number[] | null // Moderation events linked to this transition only
  queueId: number | null // Queue snapshot at transition time
  assignmentId: number | null // Active report assignment at transition time
  moderatorDid: string | null // Assigned moderator snapshot
  assignmentStartAt: string | null // Active assignment start snapshot
}

export type PartialDB = {
  [reportActivityTableName]: ReportActivity
}
