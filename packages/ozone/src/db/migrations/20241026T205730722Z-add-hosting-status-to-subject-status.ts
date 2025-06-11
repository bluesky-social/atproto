import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('hostingStatus', 'varchar', (col) =>
      col.notNull().defaultTo('unknown'),
    )
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('hostingDeletedAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('hostingUpdatedAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('hostingCreatedAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('hostingDeactivatedAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('hostingReactivatedAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('hostingStatus')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('hostingDeletedAt')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('hostingUpdatedAt')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('hostingCreatedAt')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('hostingDeactivatedAt')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('hostingReactivatedAt')
    .execute()
}
