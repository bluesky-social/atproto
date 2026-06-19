import { Selectable } from 'kysely'
import { MuteKind } from '../../proto/bsync_pb.js'

export interface MuteItem {
  actorDid: string
  subject: string // did or aturi for list
  fromId: number
  kind: MuteKind
}

export type MuteItemEntry = Selectable<MuteItem>

export const tableName = 'mute_item'

export type PartialDB = { [tableName]: MuteItem }
