import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

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

export const createTable = async (
  db: Kysely<PartialDB>,
  dialect: Dialect,
): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('username', 'varchar', (col) => col.notNull())
    .addColumn('email', 'varchar', (col) => col.notNull())
    .addColumn('password', 'varchar', (col) => col.notNull())
    .addColumn('lastSeenNotifs', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  if (dialect === 'pg') {
    await db.schema // Supports user search
      .createIndex(`${tableName}_username_tgrm_idx`)
      .on(tableName)
      .using('gist')
      .expression(sql`"username" gist_trgm_ops`)
      .execute()
  }
}
