import type { Selectable } from 'kysely'

export interface MuteItem {
  actorDid: string
  subject: string // did or aturi for list
  fromId: number
  // scope restrictions: when any is set, just the scoped content is muted;
  // when none are set, the subject is fully muted
  onlyReposts: boolean
  onlyQuoteposts: boolean
}

export type MuteItemEntry = Selectable<MuteItem>

export const tableName = 'mute_item'

export type PartialDB = { [tableName]: MuteItem }
