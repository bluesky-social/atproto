import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // supports post deletion
  await db.schema
    .createIndex('feed_item_post_uri_idx')
    .on('feed_item')
    .column('postUri')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('feed_item_post_uri_idx').execute()
}
