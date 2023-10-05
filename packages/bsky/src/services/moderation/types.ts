import { Selectable } from 'kysely'
import {
  ModerationEvent,
  ModerationSubjectStatus,
} from '../../db/tables/moderation'
import { AtUri } from '@atproto/syntax'
import { CID } from 'multiformats/cid'

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
  'id' | 'createdBy' | 'comment'
> & {
  createdAt?: Date
  subject: { did: string } | { uri: AtUri; cid: CID }
}

export type ModerationEventRowWithHandle = ModerationEventRow & {
  handle?: string | null
}
export type ModerationSubjectStatusRow = Selectable<ModerationSubjectStatus>
