import type { Generated } from 'kysely'
import type { DidString } from '@atproto/lex'
import type { tools } from '../../lexicons/index.js'

export const memberTableName = 'member'

export interface Member {
  did: DidString
  role:
    | tools.ozone.team.defs.RoleAdmin
    | tools.ozone.team.defs.RoleTriage
    | tools.ozone.team.defs.RoleVerifier
    | tools.ozone.team.defs.RoleModerator
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
