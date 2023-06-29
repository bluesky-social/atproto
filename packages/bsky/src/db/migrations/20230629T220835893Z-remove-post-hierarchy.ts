import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('post_hierarchy').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('post_hierarchy')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('ancestorUri', 'varchar', (col) => col.notNull())
    .addColumn('depth', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('post_hierarchy_pkey', ['uri', 'ancestorUri'])
    .execute()
  await db.schema
    .createIndex('post_hierarchy_ancestoruri_idx')
    .on('post_hierarchy')
    .column('ancestorUri')
    .execute()
}
