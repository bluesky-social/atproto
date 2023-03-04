import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('follow_creator_idx')
    .on('follow')
    .column('creator')
    .execute()

  await db.schema
    .createIndex('vote_creator_idx')
    .on('vote')
    .column('creator')
    .execute()

  await db.schema
    .createIndex('repost_creator_idx')
    .on('repost')
    .column('creator')
    .execute()

  await db.schema
    .createIndex('post_order_by_idx')
    .on('post')
    .columns(['indexedAt', 'cid'])
    .execute()

  await db.schema
    .createIndex('repost_order_by_idx')
    .on('repost')
    .columns(['indexedAt', 'cid'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('repost_order_by_idx').execute()
  await db.schema.dropIndex('post_order_by_idx').execute()
  await db.schema.dropIndex('repost_creator_idx').execute()
  await db.schema.dropIndex('vote_creator_idx').execute()
  await db.schema.dropIndex('follow_creator_idx').execute()
}
