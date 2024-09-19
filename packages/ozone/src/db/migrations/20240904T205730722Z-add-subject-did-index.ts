import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('moderation_event_subject_did_idx')
    .on('moderation_event')
    .column('subjectDid')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('moderation_event_subject_did_idx').execute()
}
