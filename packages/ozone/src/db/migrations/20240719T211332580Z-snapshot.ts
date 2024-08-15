import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('snapshot')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('uri', 'varchar', (col) => col.notNull().defaultTo(''))
    .addColumn('cid', 'varchar', (col) => col.notNull().defaultTo(''))
    .addColumn('record', 'jsonb', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addPrimaryKeyConstraint('did_uri_cid_pkey', ['did', 'uri', 'cid'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('snapshot')
}
