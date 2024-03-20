import { Kysely, sql } from 'kysely'

// @TODO subject indexes, naming?
// @TODO drop indexes in down()?

export async function up(db: Kysely<unknown>): Promise<void> {
  try {
    // Add trigram support, supporting user search.
    // Explicitly add to public schema, so the extension can be seen in all schemas.
    await sql`create extension if not exists pg_trgm with schema public`.execute(
      db,
    )
  } catch (err: unknown) {
    // The "if not exists" isn't bulletproof against races, and we see test suites racing to
    // create the extension. So we can just ignore errors indicating the extension already exists.
    if (!err?.['detail']?.includes?.('(pg_trgm) already exists')) throw err
  }

  // duplicateRecords
  await db.schema
    .createTable('duplicate_record')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('duplicateOf', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  // profile
  await db.schema
    .createTable('profile')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('displayName', 'varchar')
    .addColumn('description', 'varchar')
    .addColumn('avatarCid', 'varchar')
    .addColumn('bannerCid', 'varchar')
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  // for, eg, profile views
  await db.schema
    .createIndex('profile_creator_idx')
    .on('profile')
    .column('creator')
    .execute()
  await db.schema // Supports user search
    .createIndex(`profile_display_name_tgrm_idx`)
    .on('profile')
    .using('gist')
    .expression(sql`"displayName" gist_trgm_ops`)
    .execute()

  // post
  await db.schema
    .createTable('post')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('text', 'varchar', (col) => col.notNull())
    .addColumn('replyRoot', 'varchar')
    .addColumn('replyRootCid', 'varchar')
    .addColumn('replyParent', 'varchar')
    .addColumn('replyParentCid', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .execute()
  // for, eg, "postsCount" on profile views
  await db.schema
    .createIndex('post_creator_idx')
    .on('post')
    .column('creator')
    .execute()
  // for, eg, "replyCount" on posts in feed views
  await db.schema
    .createIndex('post_replyparent_idx')
    .on('post')
    .column('replyParent')
    .execute()
  await db.schema
    .createIndex('post_order_by_idx')
    .on('post')
    .columns(['sortAt', 'cid'])
    .execute()

  // postEmbedImage
  await db.schema
    .createTable('post_embed_image')
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('imageCid', 'varchar', (col) => col.notNull())
    .addColumn('alt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('post_embed_image_pkey', ['postUri', 'position'])
    .execute()

  // postEmbedExternal
  await db.schema
    .createTable('post_embed_external')
    .addColumn('postUri', 'varchar', (col) => col.primaryKey())
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('title', 'varchar', (col) => col.notNull())
    .addColumn('description', 'varchar', (col) => col.notNull())
    .addColumn('thumbCid', 'varchar')
    .execute()

  // postEmbedRecord
  await db.schema
    .createTable('post_embed_record')
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('embedUri', 'varchar', (col) => col.notNull())
    .addColumn('embedCid', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('post_embed_record_pkey', ['postUri', 'embedUri'])
    .execute()

  // postHierarchy
  await db.schema
    .createTable('post_hierarchy')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('ancestorUri', 'varchar', (col) => col.notNull())
    .addColumn('depth', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('post_hierarchy_pkey', ['uri', 'ancestorUri'])
    .execute()
  // Supports fetching all children for a post
  await db.schema
    .createIndex('post_hierarchy_ancestoruri_idx')
    .on('post_hierarchy')
    .column('ancestorUri')
    .execute()

  // repost
  await db.schema
    .createTable('repost')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .addUniqueConstraint('repost_unique_subject', ['creator', 'subject'])
    .execute()
  // for, eg, "repostCount" on posts in feed views
  await db.schema
    .createIndex('repost_subject_idx')
    .on('repost')
    .column('subject')
    .execute()
  await db.schema
    .createIndex('repost_order_by_idx')
    .on('repost')
    .columns(['sortAt', 'cid'])
    .execute()

  // feedItem
  await db.schema
    .createTable('feed_item')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('originatorDid', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('feed_item_originator_idx')
    .on('feed_item')
    .column('originatorDid')
    .execute()
  await db.schema
    .createIndex('feed_item_cursor_idx')
    .on('feed_item')
    .columns(['sortAt', 'cid'])
    .execute()

  // follow
  await db.schema
    .createTable('follow')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .addUniqueConstraint('follow_unique_subject', ['creator', 'subjectDid'])
    .execute()
  // for, eg, "followersCount" on profile views
  await db.schema
    .createIndex('follow_subjectdid_idx')
    .on('follow')
    .column('subjectDid')
    .execute()

  // like
  await db.schema
    .createTable('like')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    // Aids in index uniqueness plus post like counts
    .addUniqueConstraint('like_unique_subject', ['subject', 'creator'])
    .execute()

  // subscription
  await db.schema
    .createTable('subscription')
    .addColumn('service', 'varchar', (col) => col.notNull())
    .addColumn('method', 'varchar', (col) => col.notNull())
    .addColumn('state', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('subscription_pkey', ['service', 'method'])
    .execute()

  // actor
  await db.schema
    .createTable('actor')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('handle', 'varchar', (col) => col.unique())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('takedownId', 'integer') // foreign key created in moderation-init migration
    .execute()
  await db.schema // Supports user search
    .createIndex(`actor_handle_tgrm_idx`)
    .on('actor')
    .using('gist')
    .expression(sql`"handle" gist_trgm_ops`)
    .execute()

  // actor sync state
  await db.schema
    .createTable('actor_sync')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('commitCid', 'varchar', (col) => col.notNull())
    .addColumn('commitDataCid', 'varchar', (col) => col.notNull())
    .addColumn('rebaseCount', 'integer', (col) => col.notNull())
    .addColumn('tooBigCount', 'integer', (col) => col.notNull())
    .execute()

  //record
  await db.schema
    .createTable('record')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('json', 'text', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('takedownId', 'integer') // foreign key created in moderation-init migration
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // record
  await db.schema.dropTable('record').execute()
  // actor
  await db.schema.dropTable('actor').execute()
  // subscription
  await db.schema.dropTable('subscription').execute()
  // like
  await db.schema.dropTable('like').execute()
  // follow
  await db.schema.dropTable('follow').execute()
  // feedItem
  await db.schema.dropTable('feed_item').execute()
  // repost
  await db.schema.dropTable('repost').execute()
  // postHierarchy
  await db.schema.dropTable('post_hierarchy').execute()
  // postEmbedRecord
  await db.schema.dropTable('post_embed_record').execute()
  // postEmbedExternal
  await db.schema.dropTable('post_embed_external').execute()
  // postEmbedImage
  await db.schema.dropTable('post_embed_image').execute()
  // post
  await db.schema.dropTable('post').execute()
  // profile
  await db.schema.dropTable('profile').execute()
  // duplicateRecords
  await db.schema.dropTable('duplicate_record').execute()
}
