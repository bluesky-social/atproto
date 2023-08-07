import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // supports post deletion
  await db.schema
    .createIndex('feed_item_post_uri_idx')
    .on('feed_item')
    .column('postUri')
    .execute()
  // supports listing user invites
  await db.schema
    .createIndex('invite_code_for_user_idx')
    .on('invite_code')
    .column('forUser')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('feed_item_post_uri_idx').execute()
  await db.schema.dropIndex('invite_code_for_user_idx').execute()
}
