import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('suggested_feed')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('order', 'integer', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('suggested_feed').execute()
}
