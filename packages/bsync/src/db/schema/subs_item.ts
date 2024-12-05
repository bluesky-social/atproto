import { ColumnType, Selectable } from 'kysely'

export interface SubsItem {
  actorDid: string
  // https://github.com/kysely-org/kysely/issues/137
  entitlements: ColumnType<string[], string, string>
  fromId: number
}

export type SubsItemEntry = Selectable<SubsItem>

export const tableName = 'subs_item'

export type PartialDB = { [tableName]: SubsItem }
