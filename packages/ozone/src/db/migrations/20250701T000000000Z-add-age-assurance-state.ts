import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('ageAssuranceState', 'varchar', (col) =>
      col.notNull().defaultTo('unknown'),
    )
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('ageAssuranceUpdatedBy', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('ageAssuranceState')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('ageAssuranceUpdatedBy')
    .execute()
}
