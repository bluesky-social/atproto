import { ColumnType } from 'kysely'

export const tableName = 'purchase'

export interface Purchase {
  did: string
  // https://github.com/kysely-org/kysely/issues/137
  entitlements: ColumnType<string[], string, string>
  createdAt: string
  updatedAt: string
}

export type PartialDB = { [tableName]: Purchase }
