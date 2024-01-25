import { Selectable } from 'kysely'

export interface MuteItem {
  actorDid: string
  subject: string // did or aturi for list
  fromId: number
}

export type MuteItemEntry = Selectable<MuteItem>

export const tableName = 'mute_item'

export type PartialDB = { [tableName]: MuteItem }
