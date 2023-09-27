import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropView('algo_whats_hot_view').materialized().execute()
  await db.schema.dropTable('actor_block').execute()
  await db.schema.dropTable('duplicate_record').execute()
  await db.schema.dropTable('feed_generator').execute()
  await db.schema.dropTable('feed_item').execute()
  await db.schema.dropTable('follow').execute()
  await db.schema.dropTable('label').execute()
  await db.schema.dropTable('like').execute()
  await db.schema.dropTable('list_item').execute()
  await db.schema.dropTable('list').execute()
  await db.schema.dropTable('post_agg').execute()
  await db.schema.dropTable('post_embed_image').execute()
  await db.schema.dropTable('post_embed_external').execute()
  await db.schema.dropTable('post_embed_record').execute()
  await db.schema.dropTable('post').execute()
  await db.schema.dropTable('profile_agg').execute()
  await db.schema.dropTable('profile').execute()
  await db.schema.dropTable('repost').execute()
  await db.schema.dropTable('subscription').execute()
  await db.schema.dropTable('suggested_follow').execute()
  await db.schema.dropTable('view_param').execute()
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Migration code
}
