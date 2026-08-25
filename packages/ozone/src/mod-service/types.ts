import type { Selectable } from 'kysely'
import type { $TypeOf, DatetimeString, DidString } from '@atproto/lex'
import type { ModerationEvent } from '../db/schema/moderation_event.js'
import type { ModerationSubjectStatus } from '../db/schema/moderation_subject_status.js'
import type { tools } from '../lexicons/index.js'
import type { ModSubject } from './subject.js'

export type ModerationEventRow = Selectable<ModerationEvent>
export type ReversibleModerationEvent = Pick<
  ModerationEventRow,
  'createdBy' | 'comment' | 'action'
> & {
  createdAt?: Date
  subject: ModSubject
}

export type ModerationEventRowWithHandle = ModerationEventRow & {
  subjectHandle?: string | null
  creatorHandle?: string | null
}
export type ModerationSubjectStatusRow = Selectable<ModerationSubjectStatus>
export type ModerationSubjectStatusRowWithStats = ModerationSubjectStatusRow & {
  // account_events_stats
  takedownCount: number | null
  suspendCount: number | null
  escalateCount: number | null
  reportCount: number | null
  appealCount: number | null

  // account_record_events_stats
  totalReports: number | null
  reportedCount: number | null
  escalatedCount: number | null
  appealedCount: number | null

  // account_record_status_stats
  subjectCount: number | null
  pendingCount: number | null
  processedCount: number | null
  takendownCount: number | null

  // account_strike
  strikeCount: number | null
  totalStrikeCount: number | null
  firstStrikeAt: DatetimeString | null
  lastStrikeAt: DatetimeString | null
}

export type ModerationSubjectStatusRowWithHandle =
  ModerationSubjectStatusRowWithStats & { handle: string | null }

export type ModEventType = tools.ozone.moderation.defs.ModEventView['event']

type AccountHostingView = {
  $type: $TypeOf<tools.ozone.moderation.defs.AccountHosting>
  status: 'active' | 'takendown' | 'suspended' | 'deleted' | 'deactivated'
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
  deactivatedAt?: Date
  reactivatedAt?: Date
}

type RecordHostingView = {
  $type: $TypeOf<tools.ozone.moderation.defs.RecordHosting>
  status: 'active' | 'deleted'
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
}

export type ModerationSubjectHostingView =
  AccountHostingView | RecordHostingView

export type ReporterStats = {
  did: DidString
  accountReportCount: number
  recordReportCount: number
  reportedAccountCount: number
  reportedRecordCount: number
  takendownAccountCount: number
  takendownRecordCount: number
  labeledAccountCount: number
  labeledRecordCount: number
}

export type ReporterStatsResult = {
  accountReportCount?: number
  recordReportCount?: number
  reportedAccountCount?: number
  reportedRecordCount?: number
  takendownAccountCount?: number
  takendownRecordCount?: number
  labeledAccountCount?: number
  labeledRecordCount?: number
}
