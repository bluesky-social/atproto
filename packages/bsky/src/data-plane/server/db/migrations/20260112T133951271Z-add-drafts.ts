import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('draft')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('key', 'varchar', (col) => col.notNull())
    .addColumn('savedAt', 'varchar', (col) => col.notNull())
    .addColumn('payload', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('draft_pkey', ['creator', 'key'])
    .execute()

  // Supports getting paginated drafts by savedAt.
  await db.schema
    .createIndex('draft_creator_saved_at_key_idx')
    .on('draft')
    .columns(['creator', 'savedAt', 'key'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('draft').execute()
}
