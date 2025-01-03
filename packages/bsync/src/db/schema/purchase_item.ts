import { ColumnType, Selectable } from 'kysely'

export interface PurchaseItem {
  actorDid: string
  // https://github.com/kysely-org/kysely/issues/137
  entitlements: ColumnType<string[], string, string>
  fromId: number
}

export type PurchaseItemEntry = Selectable<PurchaseItem>

export const tableName = 'purchase_item'

export type PartialDB = { [tableName]: PurchaseItem }
