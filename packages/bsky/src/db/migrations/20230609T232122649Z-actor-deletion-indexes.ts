import { Kysely } from 'kysely'

// Indexes to support efficient actor deletion/unindexing

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema // Also supports record deletes
    .createIndex('duplicate_record_duplicate_of_idx')
    .on('duplicate_record')
    .column('duplicateOf')
    .execute()
  await db.schema
    .createIndex('like_creator_idx')
    .on('like')
    .column('creator')
    .execute()
  await db.schema
    .createIndex('notification_author_idx')
    .on('notification')
    .column('author')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('notification_author_idx').execute()
  await db.schema.dropIndex('like_creator_idx').execute()
  await db.schema.dropIndex('duplicate_record_duplicate_of_idx').execute()
}
