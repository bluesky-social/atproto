import type { Selectable } from 'kysely'
import type { StoredMuteKinds } from '../../routes/mute-kinds.js'

export interface MuteItem {
  actorDid: string
  subject: string // did or aturi for list
  fromId: number
  kinds: StoredMuteKinds
}

export type MuteItemEntry = Selectable<MuteItem>

export const tableName = 'mute_item'

export type PartialDB = { [tableName]: MuteItem }
