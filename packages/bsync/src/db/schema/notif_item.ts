import { Selectable } from 'kysely'

export interface NotifItem {
  actorDid: string
  priority: boolean
  fromId: number
}

export type NotifItemEntry = Selectable<NotifItem>

export const tableName = 'notif_item'

export type PartialDB = { [tableName]: NotifItem }
