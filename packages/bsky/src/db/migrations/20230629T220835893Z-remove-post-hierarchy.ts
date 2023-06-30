import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('post_hierarchy').execute()
  // recreate index that calculates e.g. "replyCount", turning it into a covering index
  // for uri so that recursive query for post descendents can use an index-only scan.
  await db.schema.dropIndex('post_replyparent_idx').execute()
  await sql`create index "post_replyparent_idx" on "post" ("replyParent") include ("uri")`.execute(
    db,
  )
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
  await db.schema.dropIndex('post_replyparent_idx').execute()
  await db.schema
    .createIndex('post_replyparent_idx')
    .on('post')
    .column('replyParent')
    .execute()
}
