import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('app_migration')
    .addColumn('id', 'varchar', (col) => col.notNull().primaryKey())
    .addColumn('success', 'int2', (col) => col.notNull().defaultTo(0))
    .addColumn('completedAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('app_migration').execute()
}
