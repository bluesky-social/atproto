import { Generated } from 'kysely'

export const eventTableName = 'moderation_event'

export interface ModerationEvent {
  id: Generated<number>
  action:
    | 'tools.ozone.defs#modEventTakedown'
    | 'tools.ozone.defs#modEventAcknowledge'
    | 'tools.ozone.defs#modEventEscalate'
    | 'tools.ozone.defs#modEventComment'
    | 'tools.ozone.defs#modEventLabel'
    | 'tools.ozone.defs#modEventReport'
    | 'tools.ozone.defs#modEventMute'
    | 'tools.ozone.defs#modEventReverseTakedown'
    | 'tools.ozone.defs#modEventEmail'
    | 'tools.ozone.defs#modEventResolveAppeal'
    | 'tools.ozone.defs#modEventTag'
  subjectType: 'com.atproto.admin.defs#repoRef' | 'com.atproto.repo.strongRef'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  subjectBlobCids: string[] | null
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
