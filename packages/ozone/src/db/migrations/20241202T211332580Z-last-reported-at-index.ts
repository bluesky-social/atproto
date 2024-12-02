import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('moderation_subject_status_review_state_last_reported_idx')
    .on('moderation_subject_status')
    .columns(['reviewState', 'lastReportedAt'])
    .execute()
  await db.schema
    .dropIndex('moderation_subject_status_review_state_idx')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('moderation_subject_status_review_state_idx')
    .on('moderation_subject_status')
    .column('reviewState')
    .execute()
  await db.schema
    .dropIndex('moderation_subject_status_review_state_last_reported_idx')
    .execute()
}
