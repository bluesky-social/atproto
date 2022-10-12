import { Kysely } from 'kysely'

export interface Record {
  uri: string
  cid: string
  did: string
  collection: string
  rkey: string
  raw: string
  receivedAt: string
  indexedAt: string
}

export const tableName = 'record'

export type PartialDB = { [tableName]: Record }

export const createTable = async (db: Kysely<PartialDB>): Promise<void> => {
  await db.schema
    .createTable(tableName)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('raw', 'text', (col) => col.notNull())
    .addColumn('receivedAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
}
