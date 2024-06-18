import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('member')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('role', 'varchar', (col) => col.notNull())
    .addColumn('disabled', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull())
    .addColumn('lastUpdatedBy', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('member')
}
