import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('private_record')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('actorDid', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('payload', 'text', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('private_record').execute()
}
