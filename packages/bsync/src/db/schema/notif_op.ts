import { GeneratedAlways, Selectable } from 'kysely'
import { NotifOperation_Setting } from '../../proto/bsync_pb'

export interface NotifOp {
  id: GeneratedAlways<number>
  actorDid: string
  setting: NotifOperation_Setting // integer enum: 1->normal, 2->priority
  createdAt: GeneratedAlways<Date>
}

export type NotifOpEntry = Selectable<NotifOp>

export const tableName = 'notif_op'

export type PartialDB = { [tableName]: NotifOp }

export const createNotifOpChannel = 'notif_op_create' // used with listen/notify
