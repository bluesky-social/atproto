import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('did_cache')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('doc', 'jsonb', (col) => col.notNull())
    .addColumn('updatedAt', 'bigint', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('did_cache').execute()
}
