import type { GeneratedAlways, Selectable } from 'kysely'
import type { MuteOperation_Type } from '../../proto/bsync_pb.js'

export interface MuteOp {
  id: GeneratedAlways<number>
  type: MuteOperation_Type // integer enum: 0->add, 1->remove, 2->clear
  actorDid: string
  subject: string // did or aturi for list
  // scope restrictions: when any is set, just the scoped content is muted;
  // when none are set, the subject is fully muted
  onlyReposts: boolean
  onlyQuoteposts: boolean
  createdAt: GeneratedAlways<Date>
}

export type MuteOpEntry = Selectable<MuteOp>

export const tableName = 'mute_op'

export type PartialDB = { [tableName]: MuteOp }

export const createMuteOpChannel = 'mute_op_create' // used with listen/notify
