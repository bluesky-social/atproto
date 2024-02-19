import { Selectable } from 'kysely'
import { ModerationEvent } from '../db/schema/moderation_event'
import { ModerationSubjectStatus } from '../db/schema/moderation_subject_status'
import { ComAtprotoAdminDefs } from '@atproto/api'
import { ModSubject } from './subject'

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
export type ModerationSubjectStatusRowWithHandle =
  ModerationSubjectStatusRow & { handle: string | null }

export type ModEventType =
  | ComAtprotoAdminDefs.ModEventTakedown
  | ComAtprotoAdminDefs.ModEventAcknowledge
  | ComAtprotoAdminDefs.ModEventEscalate
  | ComAtprotoAdminDefs.ModEventComment
  | ComAtprotoAdminDefs.ModEventLabel
  | ComAtprotoAdminDefs.ModEventReport
  | ComAtprotoAdminDefs.ModEventMute
  | ComAtprotoAdminDefs.ModEventReverseTakedown
  | ComAtprotoAdminDefs.ModEventTag

export const UNSPECCED_TAKEDOWN_LABEL = '!unspecced-takedown'

export const UNSPECCED_TAKEDOWN_BLOBS_LABEL = '!unspecced-takedown-blobs'
