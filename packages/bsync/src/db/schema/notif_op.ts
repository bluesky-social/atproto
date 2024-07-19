import { GeneratedAlways, Selectable } from 'kysely'

export interface NotifOp {
  id: GeneratedAlways<number>
  actorDid: string
  priority: boolean | null
  createdAt: GeneratedAlways<Date>
}

export type NotifOpEntry = Selectable<NotifOp>

export const tableName = 'notif_op'

export type PartialDB = { [tableName]: NotifOp }

export const createNotifOpChannel = 'notif_op_create' // used with listen/notify
