import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('record_collection_rkey_idx')
    .on('record')
    .columns(['collection', 'rkey'])
    .execute()

  await db.schema.dropIndex('record_collection_idx').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('record_collection_idx')
    .on('record')
    .column('collection')
    .execute()

  await db.schema.dropIndex('record_collection_rkey_idx').execute()
}
