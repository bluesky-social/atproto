import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('detach')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('post', 'varchar', (col) => col.notNull())
    .addColumn('targets', 'jsonb', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('detach').execute()
}
