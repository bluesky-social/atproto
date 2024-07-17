import { Selectable } from 'kysely'
import { NotifOperation_Setting } from '../../proto/bsync_pb'

export interface NotifItem {
  actorDid: string
  setting: NotifOperation_Setting // integer enum: 1->normal, 2->priority
  fromId: number
}

export type NotifItemEntry = Selectable<NotifItem>

export const tableName = 'notif_item'

export type PartialDB = { [tableName]: NotifItem }
