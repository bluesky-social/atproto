import { Kysely } from 'kysely'

export interface RepoRoot {
  did: string
  root: string
  indexedAt: string
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('root', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
}
