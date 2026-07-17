import type { Selectable } from 'kysely'

export interface MuteItem {
  actorDid: string
  subject: string // did or aturi for list
  fromId: number
  kinds: string // comma-separated MuteKind names; empty means a full mute
}

export type MuteItemEntry = Selectable<MuteItem>

export const tableName = 'mute_item'

export type PartialDB = { [tableName]: MuteItem }
