import type { GeneratedAlways, Selectable } from 'kysely'
import type { MuteOperation_Type } from '../../proto/bsync_pb.js'
import type { StoredMuteKinds } from '../../routes/mute-kinds.js'

export interface MuteOp {
  id: GeneratedAlways<number>
  type: MuteOperation_Type // integer enum: 0->add, 1->remove, 2->clear
  actorDid: string
  subject: string // did or aturi for list
  kinds: StoredMuteKinds
  createdAt: GeneratedAlways<Date>
}

export type MuteOpEntry = Selectable<MuteOp>

export const tableName = 'mute_op'

export type PartialDB = { [tableName]: MuteOp }

export const createMuteOpChannel = 'mute_op_create' // used with listen/notify
