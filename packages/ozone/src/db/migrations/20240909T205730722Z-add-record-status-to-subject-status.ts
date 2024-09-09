import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('recordStatus', 'varchar')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('recordDeletedAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('recordUpdatedAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('recordStatus')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('recordDeletedAt')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('recordUpdatedAt')
    .execute()
}
