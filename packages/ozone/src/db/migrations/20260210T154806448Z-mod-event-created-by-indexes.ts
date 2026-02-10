import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('moderation_event_created_by_idx')
    .on('moderation_event')
    .column('createdBy')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('moderation_event_created_by_idx').execute()
}
