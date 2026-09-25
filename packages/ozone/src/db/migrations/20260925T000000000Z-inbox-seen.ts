import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('inbox_seen')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('section', 'varchar', (col) => col.notNull())
    .addColumn('seenAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('inbox_seen_pk', ['did', 'section'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('inbox_seen').execute()
}
