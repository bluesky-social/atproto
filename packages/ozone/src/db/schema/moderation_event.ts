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
  meta: Record<string, string | boolean> | null
  addedTags: string[] | null
  removedTags: string[] | null
  legacyRefId: number | null
}

export type PartialDB = {
  [eventTableName]: ModerationEvent
}
