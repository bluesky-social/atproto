import { Kysely, sql } from 'kysely'

// Initial schema bootstrap. Filename follows the bsky/Kysely convention:
//   {UTC-timestamp}-{short-name}.ts
// Migrations run in alphabetical order, so the timestamp controls ordering.
// Future migrations get their own timestamped files (e.g. via migration:create).

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('actor')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('handle', 'varchar')
    .addColumn('pdsEndpoint', 'varchar')
    .addColumn('displayName', 'varchar')
    .addColumn('description', 'varchar')
    .addColumn('avatarCid', 'varchar')
    .addColumn('bannerCid', 'varchar')
    .addColumn('followersCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('postsCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('upstreamStatus', 'varchar', (col) =>
      col.notNull().defaultTo('active'),
    )
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('post')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('caption', 'varchar')
    .addColumn('mediaType', 'varchar')
    .addColumn('mediaJson', 'jsonb')
    .addColumn('likeCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('post_creator_idx')
    .on('post')
    .column('creator')
    .execute()
  await db.schema
    .createIndex('post_created_at_idx')
    .on('post')
    .column('createdAt')
    .execute()

  await db.schema
    .createTable('follow')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('follow_unique_subject', ['creator', 'subjectDid'])
    .execute()
  await db.schema
    .createIndex('follow_creator_idx')
    .on('follow')
    .column('creator')
    .execute()
  await db.schema
    .createIndex('follow_subject_did_idx')
    .on('follow')
    .column('subjectDid')
    .execute()

  await db.schema
    .createTable('like')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('like_unique_subject', ['creator', 'subject'])
    .execute()
  await db.schema
    .createIndex('like_subject_idx')
    .on('like')
    .column('subject')
    .execute()

  await db.schema
    .createTable('subscription_cursor')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('lastSeq', 'bigint', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addCheckConstraint('subscription_cursor_singleton_check', sql`id = 1`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('subscription_cursor').execute()
  await db.schema.dropTable('like').execute()
  await db.schema.dropTable('follow').execute()
  await db.schema.dropTable('post').execute()
  await db.schema.dropTable('actor').execute()
}
