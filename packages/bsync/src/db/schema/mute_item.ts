import { Selectable } from 'kysely'

export interface MuteItem {
  did: string
  subject: string
  fromId: number
}

export type MuteItemEntry = Selectable<MuteItem>

export const tableName = 'mute_item'

export type PartialDB = { [tableName]: MuteItem }
