import { ColumnType, GeneratedAlways, Selectable } from 'kysely'

export interface SubsOp {
  id: GeneratedAlways<number>
  actorDid: string
  // https://github.com/kysely-org/kysely/issues/137
  entitlements: ColumnType<string[], string, string>
  createdAt: GeneratedAlways<Date>
}

export type SubsOpEntry = Selectable<SubsOp>

export const tableName = 'subs_op'

export type PartialDB = { [tableName]: SubsOp }

export const createSubsOpChannel = 'subs_op_create' // used with listen/notify
