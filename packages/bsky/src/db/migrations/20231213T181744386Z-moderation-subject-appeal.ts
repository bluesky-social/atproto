import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('lastAppealedAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('appealed', 'boolean')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('lastAppealedAt')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('appealed')
    .execute()
}
