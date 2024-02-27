import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .addColumn('addedTags', 'jsonb')
    .execute()
  await db.schema
    .alterTable('moderation_event')
    .addColumn('removedTags', 'jsonb')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('tags', 'jsonb')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .dropColumn('addedTags')
    .execute()
  await db.schema
    .alterTable('moderation_event')
    .dropColumn('removedTags')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('tags')
    .execute()
}
