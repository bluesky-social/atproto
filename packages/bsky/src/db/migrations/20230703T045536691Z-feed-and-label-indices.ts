import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('label_cts_idx')
    .on('label')
    .column('cts')
    .execute()
  await db.schema.dropIndex('feed_item_originator_idx').execute()
  await db.schema
    .createIndex('feed_item_originator_cursor_idx')
    .on('feed_item')
    .columns(['originatorDid', 'sortAt', 'cid'])
    .execute()
  await db.schema
    .createIndex('record_did_idx')
    .on('record')
    .column('did')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('label_cts_idx').execute()
  await db.schema.dropIndex('feed_item_originator_cursor_idx').execute()
  await db.schema
    .createIndex('feed_item_originator_idx')
    .on('feed_item')
    .column('originatorDid')
    .execute()
  await db.schema.dropIndex('record_did_idx').execute()
}
