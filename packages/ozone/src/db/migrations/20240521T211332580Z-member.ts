import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('member')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('disabled', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('createdAt', 'timestamptz')
    .addColumn('updatedAt', 'timestamptz')
    .addColumn('lastUpdatedBy', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('member')
}
