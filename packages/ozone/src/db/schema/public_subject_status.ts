import { Generated } from 'kysely'
import {
  MODACTIONLABEL,
  MODACTIONPENDING,
  MODACTIONRESOLVE,
  MODACTIONSUSPEND,
  MODACTIONTAKEDOWN,
} from '../../lexicon/types/tools/ozone/history/defs'

export const publicSubjectStatusTableName = 'public_subject_status'

export interface PublicSubjectStatus {
  id: Generated<number>
  viewerDid: string
  isAuthor: boolean
  did: string
  recordPath: string
  modAction:
    | typeof MODACTIONLABEL
    | typeof MODACTIONRESOLVE
    | typeof MODACTIONSUSPEND
    | typeof MODACTIONTAKEDOWN
    | typeof MODACTIONPENDING
  comment: string | null
  createdAt: string
  updatedAt: string
}

export type PartialDB = {
  [publicSubjectStatusTableName]: PublicSubjectStatus
}
