import { Generated, GeneratedAlways } from 'kysely'

export const moderatorTableName = 'moderator'

export interface Moderator {
  id: GeneratedAlways<number>
  did: string
  role:
    | 'tools.ozone.moderator.defs#modRoleAdmin'
    | 'tools.ozone.moderator.defs#modRoleTriage'
    | 'tools.ozone.moderator.defs#modRoleModerator'
  disabled: Generated<boolean>
  createdAt: string
  updatedAt: string
  lastUpdatedBy: string
}

export type PartialDB = {
  [moderatorTableName]: Moderator
}
