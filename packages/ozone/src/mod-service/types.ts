import { Selectable } from 'kysely'
import { ModerationEvent } from '../db/schema/moderation_event'
import { ModerationSubjectStatus } from '../db/schema/moderation_subject_status'
import { ToolsOzoneModerationDefs } from '@atproto/api'
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
  | ToolsOzoneModerationDefs.ModEventTakedown
  | ToolsOzoneModerationDefs.ModEventAcknowledge
  | ToolsOzoneModerationDefs.ModEventEscalate
  | ToolsOzoneModerationDefs.ModEventComment
  | ToolsOzoneModerationDefs.ModEventLabel
  | ToolsOzoneModerationDefs.ModEventReport
  | ToolsOzoneModerationDefs.ModEventMute
  | ToolsOzoneModerationDefs.ModEventReverseTakedown
  | ToolsOzoneModerationDefs.ModEventTag
  | ToolsOzoneModerationDefs.AccountEvent
  | ToolsOzoneModerationDefs.IdentityEvent
  | ToolsOzoneModerationDefs.RecordEvent

type AccountHostingView = {
  $type: 'tools.ozone.moderation.defs#accountHosting'
  status: 'active' | 'takendown' | 'suspended' | 'deleted' | 'deactivated'
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
  deactivatedAt?: Date
  reactivatedAt?: Date
}

type RecordHostingView = {
  $type: 'tools.ozone.moderation.defs#recordHosting'
  status: 'active' | 'deleted'
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
}

export type ModerationSubjectHostingView =
  | AccountHostingView
  | RecordHostingView
