import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('configuration')
    .addColumn('key', 'varchar', (col) => col.notNull())
    .addColumn('value', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('configuration_pkey', ['key', 'value'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('configuration').execute()
}
