import { GeneratedAlways, Selectable } from 'kysely'
import { MuteOperation_Type } from '../../gen/bsky_sync_pb'

export interface MuteOp {
  id: GeneratedAlways<number>
  type: MuteOperation_Type // integer enum: 0->add, 1->remove, 2->clear
  actorDid: string
  subject: string // did or aturi for list
  createdAt: GeneratedAlways<Date>
}

export type MuteOpEntry = Selectable<MuteOp>

export const tableName = 'mute_op'

export type PartialDB = { [tableName]: MuteOp }
