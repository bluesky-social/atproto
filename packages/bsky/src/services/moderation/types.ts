import { Selectable } from 'kysely'
import {
  ModerationAction,
  ModerationReport,
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

export type ModerationActionRow = Selectable<ModerationAction>
export type ReversibleModerationAction = Pick<
  ModerationActionRow,
  'id' | 'createdBy' | 'comment'
> & {
  createdAt?: Date
  subject: { did: string } | { uri: AtUri; cid: CID }
}

export type ModerationActionRowWithHandle = ModerationActionRow & {
  handle?: string | null
}
export type ModerationSubjectStatusRow = Selectable<ModerationSubjectStatus>
