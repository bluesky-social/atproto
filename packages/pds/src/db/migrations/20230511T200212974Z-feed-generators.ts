import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('feed_generator')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('feedDid', 'varchar', (col) => col.notNull())
    .addColumn('displayName', 'varchar')
    .addColumn('description', 'varchar')
    .addColumn('descriptionFacets', 'varchar')
    .addColumn('avatarCid', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('feed_generator_creator_index')
    .on('feed_generator')
    .column('creator')
    .execute()

  await db.schema
    .createIndex('feed_generator_feed_did_index')
    .on('feed_generator')
    .column('feedDid')
    .execute()

  await db.schema
    .createTable('did_cache')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('doc', 'text', (col) => col.notNull())
    .addColumn('updatedAt', 'bigint', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('did_cache').execute()
  await db.schema.dropIndex('feed_generator_creator_index').execute()
  await db.schema.dropIndex('feed_generator_feed_did_index').execute()
  await db.schema.dropTable('feed_generator').execute()
}
