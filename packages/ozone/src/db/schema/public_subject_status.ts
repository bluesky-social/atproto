import { Generated } from 'kysely'
import {
  REVIEWCLOSED,
  REVIEWOPEN,
  REVIEWESCALATED,
  REVIEWNONE,
} from '../../lexicon/types/tools/ozone/moderation/defs'

export const publicSubjectStatusTableName = 'public_subject_status'

export interface PublicSubjectStatus {
  id: Generated<number>
  did: string
  recordPath: string
  // @TODO: Update the reviewState values. these probably shouldn't match the internal moderation state
  reviewState:
    | typeof REVIEWCLOSED
    | typeof REVIEWOPEN
    | typeof REVIEWESCALATED
    | typeof REVIEWNONE
  comment: string | null
  createdAt: string
  updatedAt: string
}

export type PartialDB = {
  [publicSubjectStatusTableName]: PublicSubjectStatus
}
