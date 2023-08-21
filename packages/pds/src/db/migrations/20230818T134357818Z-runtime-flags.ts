import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('runtime_flag')
    .addColumn('name', 'varchar', (col) => col.primaryKey())
    .addColumn('value', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('runtime_flag').execute()
}
