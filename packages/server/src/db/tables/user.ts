import { Kysely } from 'kysely'

export interface User {
  did: string
  username: string
  email: string
  password: string
  lastSeenNotifs: string
  createdAt: string
}

export const tableName = 'user'

export type PartialDB = { [tableName]: User }

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('username', 'varchar', (col) => col.notNull())
    .addColumn('email', 'varchar', (col) => col.notNull())
    .addColumn('password', 'varchar', (col) => col.notNull())
    .addColumn('lastSeenNotifs', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
}
