import { Selectable } from 'kysely'
import {
  ModerationEvent,
  ModerationSubjectStatus,
} from '../../db/tables/moderation'
import { AtUri } from '@atproto/syntax'
import { CID } from 'multiformats/cid'
import { ComAtprotoAdminDefs } from '@atproto/api'

export type SubjectInfo =
  | {
      subjectType: 'com.atproto.admin.defs#repoRef'
      subjectDid: string
      subjectUri: null
      subjectCid: null
    }
  | {
      subjectType: 'com.atproto.repo.strongRef'
      subjectDid: string
      subjectUri: string
      subjectCid: string
    }

export type ModerationEventRow = Selectable<ModerationEvent>
export type ReversibleModerationEvent = Pick<
  ModerationEventRow,
  'createdBy' | 'comment' | 'action'
> & {
  createdAt?: Date
  subject: { did: string } | { uri: AtUri; cid: CID }
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
