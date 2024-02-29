import { Generated } from 'kysely'

export const eventTableName = 'moderation_event'

export interface ModerationEvent {
  id: Generated<number>
  action:
    | 'com.atproto.admin.defs#modEventTakedown'
    | 'com.atproto.admin.defs#modEventAcknowledge'
    | 'com.atproto.admin.defs#modEventEscalate'
    | 'com.atproto.admin.defs#modEventComment'
    | 'com.atproto.admin.defs#modEventLabel'
    | 'com.atproto.admin.defs#modEventReport'
    | 'com.atproto.admin.defs#modEventMute'
    | 'com.atproto.admin.defs#modEventReverseTakedown'
    | 'com.atproto.admin.defs#modEventEmail'
    | 'com.atproto.admin.defs#modEventResolveAppeal'
    | 'com.atproto.admin.defs#modEventTag'
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
