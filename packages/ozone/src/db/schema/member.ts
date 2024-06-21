import { Generated } from 'kysely'

export const memberTableName = 'member'

export interface Member {
  did: string
  role:
    | 'tools.ozone.team.defs#roleAdmin'
    | 'tools.ozone.team.defs#roleTriage'
    | 'tools.ozone.team.defs#roleModerator'
  disabled: Generated<boolean>
  createdAt: Date
  updatedAt: Date
  lastUpdatedBy: string
}

export type PartialDB = {
  [memberTableName]: Member
}
