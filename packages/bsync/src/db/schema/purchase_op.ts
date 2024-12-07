import { ColumnType, GeneratedAlways, Selectable } from 'kysely'

export interface PurchaseOp {
  id: GeneratedAlways<number>
  actorDid: string
  // https://github.com/kysely-org/kysely/issues/137
  entitlements: ColumnType<string[], string, string>
  createdAt: GeneratedAlways<Date>
}

export type PurchaseOpEntry = Selectable<PurchaseOp>

export const tableName = 'purchase_op'

export type PartialDB = { [tableName]: PurchaseOp }

export const createPurchaseOpChannel = 'purchase_op_create' // used with listen/notify
