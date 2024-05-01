import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('moderator')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('did', 'varchar', (col) => col.notNull().unique())
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('disabled', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('createdAt', 'timestamptz')
    .addColumn('updatedAt', 'timestamptz')
    .addColumn('lastUpdatedBy', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('moderator')
}
