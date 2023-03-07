import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
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
}
