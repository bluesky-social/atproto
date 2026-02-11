import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // @NOTE: These queries should be run with the "CONCURRENTLY" option in
  // production to avoid locking the table. This is not supported by Kysely.
  await db.schema
    .dropIndex('moderation_event_created_by_idx')
    .ifExists()
    .execute()
  await db.schema
    .createIndex('moderation_event_created_by_idx')
    .on('moderation_event')
    .columns(['createdBy', 'createdAt', 'id'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('moderation_event_created_by_idx')
    .ifExists()
    .execute()
}
