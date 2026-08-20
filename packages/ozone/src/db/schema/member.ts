import type { Generated } from 'kysely'
import type { DidString } from '@atproto/lex'

export const memberTableName = 'member'

export interface Member {
  did: DidString
  role:
    | 'tools.ozone.team.defs#roleAdmin'
    | 'tools.ozone.team.defs#roleTriage'
    | 'tools.ozone.team.defs#roleVerifier'
    | 'tools.ozone.team.defs#roleModerator'
  disabled: Generated<boolean>
  handle: string | null
  displayName: string | null
  createdAt: Date
  updatedAt: Date
  lastUpdatedBy: string
}

export type PartialDB = {
  [memberTableName]: Member
}
