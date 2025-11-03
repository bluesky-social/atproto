import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add composite index for efficient follow request queries by subject
  // This optimizes queries like "get all follow requests for a specific DID"
  // The backlink table already has path+linkTo index, but this adds collection-specific optimization
  await db.schema
    .createIndex('record_collection_rkey_idx')
    .on('record')
    .columns(['collection', 'rkey'])
    .execute()

  // Add index for querying records by collection and indexed time
  // This helps with queries like "get recent follow requests for a subject"
  await db.schema
    .createIndex('record_collection_indexed_at_idx')
    .on('record')
    .columns(['collection', 'indexedAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('record_collection_indexed_at_idx').execute()
  await db.schema.dropIndex('record_collection_rkey_idx').execute()
}
