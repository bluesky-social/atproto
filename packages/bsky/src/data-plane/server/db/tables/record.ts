import type { ColumnType } from 'kysely'

export interface Record {
  uri: string
  cid: string
  did: string
  json: string
  indexedAt: string
  editedAt: string | null
  takedownRef: string | null
  tags: ColumnType<string[] | null, string | undefined, string> | null
}

export const tableName = 'record'

export type PartialDB = { [tableName]: Record }
