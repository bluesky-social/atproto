import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('record_cid_index')
    .on('record')
    .columns(['did', 'cid'])
    .execute()

  await db.schema
    .createIndex('record_collection_index')
    .on('record')
    .columns(['did', 'collection'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('record_cid_index').execute()
  await db.schema.dropIndex('record_collection_index').execute()
}
