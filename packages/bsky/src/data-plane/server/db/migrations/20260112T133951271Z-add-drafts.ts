import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('draft')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('key', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('payload', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('draft_pkey', ['creator', 'key'])
    .execute()

  // Supports getting paginated drafts by updatedAt.
  await db.schema
    .createIndex('draft_creator_updated_at_key_idx')
    .on('draft')
    .columns(['creator', 'updatedAt', 'key'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('draft').execute()
}
