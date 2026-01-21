import { Generated } from 'kysely'

export const eventTableName = 'moderation_event'

export interface ModerationEvent {
  id: Generated<number>
  action:
    | 'tools.ozone.moderation.defs#modEventTakedown'
    | 'tools.ozone.moderation.defs#modEventAcknowledge'
    | 'tools.ozone.moderation.defs#modEventEscalate'
    | 'tools.ozone.moderation.defs#modEventComment'
    | 'tools.ozone.moderation.defs#modEventLabel'
    | 'tools.ozone.moderation.defs#modEventReport'
    | 'tools.ozone.moderation.defs#modEventMute'
    | 'tools.ozone.moderation.defs#modEventUnmute'
    | 'tools.ozone.moderation.defs#modEventMuteReporter'
    | 'tools.ozone.moderation.defs#modEventUnmuteReporter'
    | 'tools.ozone.moderation.defs#modEventReverseTakedown'
    | 'tools.ozone.moderation.defs#modEventEmail'
    | 'tools.ozone.moderation.defs#modEventResolveAppeal'
    | 'tools.ozone.moderation.defs#modEventTag'
    | 'tools.ozone.moderation.defs#accountEvent'
    | 'tools.ozone.moderation.defs#identityEvent'
    | 'tools.ozone.moderation.defs#recordEvent'
    | 'tools.ozone.moderation.defs#modEventPriorityScore'
    | 'tools.ozone.moderation.defs#ageAssuranceEvent'
    | 'tools.ozone.moderation.defs#ageAssuranceOverrideEvent'
    | 'tools.ozone.moderation.defs#revokeAccountCredentialsEvent'
  subjectType:
    | 'com.atproto.admin.defs#repoRef'
    | 'com.atproto.repo.strongRef'
    | 'chat.bsky.convo.defs#messageRef'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  subjectBlobCids: string[] | null
  subjectMessageId: string | null
  createLabelVals: string | null
  negateLabelVals: string | null
  comment: string | null
  createdAt: string
  createdBy: string
  durationInHours: number | null
  expiresAt: string | null
  meta: Record<string, string | boolean | number> | null
  addedTags: string[] | null
  removedTags: string[] | null
  legacyRefId: number | null
  modTool: { name: string; meta?: { [_ in string]: unknown } } | null
  externalId: string | null
  severityLevel: string | null
  strikeCount: number | null
  strikeExpiresAt: string | null
}

export type PartialDB = {
  [eventTableName]: ModerationEvent
}
